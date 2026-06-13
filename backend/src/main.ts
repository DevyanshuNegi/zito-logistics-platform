import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { config as loadEnv } from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module';
import { BRAND } from './config/brand.config';
import { corsOriginValidator } from './config/cors.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { RequestMetricsInterceptor } from './common/interceptors/request-metrics.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

loadEnv({ path: resolve(process.cwd(), '.env'), quiet: true });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true, quiet: true });
loadEnv({ path: resolve(process.cwd(), 'backend/.env'), override: false, quiet: true });
loadEnv({ path: resolve(process.cwd(), 'backend/.env.local'), override: true, quiet: true });

/**
 * Validate all required environment variables at startup.
 * Fails immediately if critical config is missing.
 * PRD §28 - Security: Fail fast on misconfiguration
 */
function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'NODE_ENV',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `See backend/.env.example for the complete list.`,
    );
  }

  const weakSecretKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((key) => {
    const value = process.env[key] ?? '';
    return (
      value.length < 32 ||
      value.includes('replace_with') ||
      value.includes('zito-secure-secret-key')
    );
  });

  if (weakSecretKeys.length > 0) {
    throw new Error(
      `Weak security secret(s): ${weakSecretKeys.join(', ')}. ` +
        'Use unique random values of at least 32 characters.',
    );
  }

  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  if (isProduction) {
    const otpMode = (process.env.OTP_MODE ?? '').trim().toLowerCase();
    const bypassProductionHardErrors = process.env.BYPASS_PROD_CHECKS === 'true';
    const isMpesaActive = !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET);

    const productionRequired = [
      'ALLOWED_ORIGINS',
      ...(isMpesaActive ? ['MPESA_CALLBACK_SECRET'] : []),
    ];
    const missingProduction = productionRequired.filter((key) => !process.env[key]);
    if (missingProduction.length > 0) {
      if (bypassProductionHardErrors) {
        console.warn(`WARNING [Bypassed]: Missing production security variables: ${missingProduction.join(', ')}.`);
      } else {
        throw new Error(
          `Missing production security variables: ${missingProduction.join(', ')}.`,
        );
      }
    }

    const allowedOrigins = process.env.ALLOWED_ORIGINS ?? '';
    if (/localhost|127\.0\.0\.1/i.test(allowedOrigins)) {
      if (bypassProductionHardErrors) {
        console.warn('WARNING [Bypassed]: Production ALLOWED_ORIGINS must not include localhost origins');
      } else {
        throw new Error('Production ALLOWED_ORIGINS must not include localhost origins');
      }
    }

    if (process.env.MPESA_ENVIRONMENT === 'sandbox') {
      if (bypassProductionHardErrors) {
        console.warn('WARNING [Bypassed]: Production must not use MPESA_ENVIRONMENT=sandbox');
      } else {
        throw new Error('Production must not use MPESA_ENVIRONMENT=sandbox');
      }
    }

    if (otpMode === 'test') {
      if (bypassProductionHardErrors) {
        console.warn('WARNING [Bypassed]: OTP_MODE=test is forbidden in production');
      } else {
        throw new Error('OTP_MODE=test is forbidden in production');
      }
    }

    if (otpMode !== 'twilio' && otpMode !== 'africastalking') {
      if (bypassProductionHardErrors) {
        console.warn('WARNING [Bypassed]: Production OTP_MODE must be twilio or africastalking');
      } else {
        throw new Error('Production OTP_MODE must be twilio or africastalking');
      }
    }
  }

  // Log which optional providers are configured
  const providers = {
    'M-Pesa': ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET'],
    'Twilio SMS': ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    'Resend Email': ['RESEND_API_KEY'],
    'Redis': ['REDIS_URL'],
  };

  const configured = Object.entries(providers)
    .filter(([, keys]) => keys.every((key) => process.env[key]))
    .map(([name]) => name);

  if (configured.length === 0) {
    console.warn(
      'WARNING: No external providers configured (M-Pesa, Twilio, Resend, Redis). ' +
        'Payment, SMS, email, and caching will not work. This is expected for local testing only.',
    );
  }
}

async function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve, reject) => {
    const tester = createServer()
      .once('error', (error: NodeJS.ErrnoException) => {
        tester.close();
        if (error.code === 'EADDRINUSE') {
          resolve(false);
          return;
        }
        reject(error);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      });

    tester.listen(port, '::');
  });
}

async function bootstrap() {
  // Validate environment variables FIRST, before creating NestJS app
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug'],
  });

  // Enable trust proxy for rate limiting behind reverse proxies (like Railway)
  app.set('trust proxy', 1);

  // PRD §28 - Security headers
  app.use(helmet());

  if (process.env.NODE_ENV !== 'production') {
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
      prefix: '/uploads/',
    });
  }

  // PRD §23 - Compression for low-bandwidth support
  app.use(compression());

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT_PER_15_MINUTES ?? 30),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  app.use(globalLimiter);
  app.use('/api/v1/auth', authLimiter);

  // PRD §28, §42 - CORS locked to whitelisted origins only
  app.enableCors({
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Idempotency-Key',
      'x-idempotency-key',
      'X-Correlation-Id',
      'x-correlation-id',
      'X-Request-Id',
      'x-request-id',
      'X-Tenant-Id',
      'x-tenant-id',
    ],
    credentials: true,
  });

  // PRD §45 - All endpoints under /api/v1
  app.setGlobalPrefix('api/v1');

  // PRD §28, §22 - Structured error responses, no stack traces in production
  app.useGlobalFilters(app.get(GlobalExceptionFilter));

  // PRD §44.11 - Request metrics for failure-rate and latency monitoring
  app.useGlobalInterceptors(app.get(RequestContextInterceptor));
  app.useGlobalInterceptors(app.get(IdempotencyInterceptor));
  app.useGlobalInterceptors(app.get(AuditInterceptor));
  app.useGlobalInterceptors(app.get(RequestMetricsInterceptor));

  // PRD §28, §6 - Validate and strip unknown fields on all requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // PRD §45 - Swagger docs (dev and staging only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle(`${BRAND.appName} API | ${BRAND.companyName}`)
      .setDescription(
        `REST API for ${BRAND.appName} by ${BRAND.companyName} - PRD v10 ULTIMATE\n\n` +
      '**Roles:** CUSTOMER · DRIVER · AGENT · TRANSPORTER · COURIER_COMPANY · WAREHOUSE_PARTNER · AGENCY_STAFF · ADMIN · SUPER_ADMIN · CORPORATE\n\n' +
          '**Auth:** All endpoints require Bearer JWT except /auth/login and /auth/send-otp.\n\n' +
          '**Idempotency:** Booking, payment, and wallet endpoints require Idempotency-Key header.',
      )
      .setVersion('v10 ULTIMATE')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addTag('Auth', 'PRD §3 - Login, OTP, sessions')
      .addTag('Users', 'PRD §2, §4 - Accounts and KYC')
      .addTag('Agencies', 'PRD §31 - Branch management')
      .addTag('Staff', 'PRD §32 - Staff roles and access')
      .addTag('Bookings', 'PRD §6 - Full booking lifecycle')
      .addTag('Drivers', 'PRD §8, §44.1, §44.2 - Driver system and shifts')
      .addTag('Fleet', 'PRD §9 - Vehicles and fleet')
      .addTag('Warehouses', 'PRD §10 - Warehouse structure')
      .addTag('Inventory', 'PRD §11 - Parcel tracking')
      .addTag('Scan', 'PRD §12 - Barcode scan system')
      .addTag('Waybills', 'PRD §14 - LR and waybill documents')
      .addTag('Payments', 'PRD §15 - M-Pesa, wallet, escrow')
      .addTag('Invoices', 'PRD §16 - Billing and invoices')
      .addTag('RateCards', 'PRD §19 - Dynamic pricing engine')
      .addTag('Contracts', 'PRD §20 - B2B contract system')
      .addTag('SLA', 'PRD §21, §44.10 - SLA timers and escalation')
      .addTag('Notifications', 'PRD §22 - SMS, email, push')
      .addTag('Tracking', 'PRD §26 - Real-time GPS tracking')
      .addTag('Support', 'PRD §25, §36 - Support tickets')
      .addTag('Analytics', 'PRD §27A, §27B - Reporting and retention')
      .addTag('Audit', 'PRD §40 - Immutable audit trail')
      .addTag('Alerts', 'PRD §39 - Internal alert system')
      .addTag('Fraud', 'PRD §44.7 - Fraud detection')
      .addTag('SurgePricing', 'PRD §44.8 - Surge engine')
      .addTag('RouteOptimization', 'PRD §44.17 - Route calculation')
      .addTag('CapacityPlanning', 'PRD §44.18 - Warehouse and fleet planning')
      .addTag('Heatmap', 'PRD §44.21 - Driver demand heatmap')
      .addTag('SystemHealth', 'PRD §44.11 - System health monitoring')
      .addTag('Marketplace', 'PRD §44.20 - Aggregator mode')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    });
  }

  // PRD §30 - Graceful shutdown for RTO 4hr / RPO 1hr targets
  app.enableShutdownHooks();

  const port = Number(process.env.PORT || 5000);

  const portAvailable = await isPortAvailable(port);
  if (!portAvailable) {
    console.error('\n===========================================');
    console.error(`  ${BRAND.appName} API could not start`);
    console.error(`  Port ${port} is already in use by another process.`);
    console.error("  Keep the existing backend, or run 'npm run start:dev:clean'.");
    console.error('===========================================\n');
    await app.close().catch(() => undefined);
    process.exitCode = 1;
    return;
  }

  await app.listen(port);

  console.log('\n===========================================');
  console.log(`  ${BRAND.appName} API - ${BRAND.companyName}`);
  console.log('  PRD: v10 ULTIMATE');
  console.log(`  ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  URL: http://localhost:${port}/api/v1`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`  Docs: http://localhost:${port}/api/docs`);
  }
  console.log('===========================================\n');
}

bootstrap();
