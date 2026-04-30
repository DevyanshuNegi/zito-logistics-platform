import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { BRAND } from './config/brand.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestMetricsInterceptor } from './common/interceptors/request-metrics.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['error', 'warn', 'log', 'debug'],
  });

  // PRD §28 - Security headers
  app.use(helmet());

  // PRD §23 - Compression for low-bandwidth support
  app.use(compression());

  // PRD §28, §42 - CORS locked to whitelisted origins only
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: origin ${origin} not permitted`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Idempotency-Key',
      'x-idempotency-key',
    ],
    credentials: true,
  });

  // PRD §45 - All endpoints under /api/v1
  app.setGlobalPrefix('api/v1');

  // PRD §28, §22 - Structured error responses, no stack traces in production
  app.useGlobalFilters(app.get(GlobalExceptionFilter));

  // PRD §44.11 - Request metrics for failure-rate and latency monitoring
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
      '**Roles:** CUSTOMER · DRIVER · TRANSPORTER · COURIER_COMPANY · WAREHOUSE_PARTNER · AGENCY_STAFF · ADMIN · SUPER_ADMIN · CORPORATE\n\n' +
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

  const port = process.env.PORT || 3000;
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
