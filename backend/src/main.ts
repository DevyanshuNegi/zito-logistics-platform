import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // PRD §28: Suppress stack traces in production responses
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn', 'log', 'debug'],
  });

  // ─── Security Headers (PRD §28) ───────────────────────────────────────────
  // Protects against common web vulnerabilities: XSS, clickjacking, MIME sniffing
  app.use(helmet());

  // ─── Compression ──────────────────────────────────────────────────────────
  // PRD §23: Low-bandwidth UI — compress all responses
  app.use(compression());

  // ─── CORS (PRD §28, §42) ──────────────────────────────────────────────────
  // Locked to known frontend origins only — not open to all origins
  // PRD §42: Separate portals: /admin, /staff, /app — all must be whitelisted
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001')
    .split(',')
    .map(o => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server (no origin) and whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: origin ${origin} not permitted`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
    credentials: true,
  });

  // ─── Global API Prefix (PRD §45) ──────────────────────────────────────────
  // All API endpoints versioned under /api/v1
  app.setGlobalPrefix('api/v1');

  // ─── Global Exception Filter (PRD §28, §22) ───────────────────────────────
  // Structured error responses with correct HTTP status codes
  // Prevents raw stack traces leaking in production
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Validation Pipe (PRD §28, §6) ───────────────────────────────────────
  // Strips unknown fields, enforces DTO types, auto-transforms primitives
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,              // Strip unknown properties
    forbidNonWhitelisted: true,   // Reject requests with unknown properties
    transform: true,              // Auto-transform payloads to DTO types
    transformOptions: {
      enableImplicitConversion: true, // Allow string → number conversion in DTOs
    },
  }));

  // ─── Swagger / API Docs (PRD §45) ─────────────────────────────────────────
  // Only expose in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ZITO Super App — API')
      .setDescription(
        'Authoritative REST API documentation aligned to ZITO PRD v10 ULTIMATE.\n\n' +
        '**Roles:** CUSTOMER · DRIVER · TRANSPORTER · WAREHOUSE_PARTNER · AGENCY_STAFF · ADMIN · SUPER_ADMIN · CORPORATE\n\n' +
        '**Auth:** All endpoints require Bearer JWT token except /auth/login and /auth/send-otp.\n\n' +
        '**Idempotency:** Booking, payment, and wallet endpoints require X-Idempotency-Key header.',
      )
      .setVersion('v10 ULTIMATE')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addTag('Auth', 'PRD §3 — Login, OTP, session management')
      .addTag('Users', 'PRD §2, §4 — User accounts and KYC')
      .addTag('Agencies', 'PRD §31 — Branch management')
      .addTag('Staff', 'PRD §32 — Staff roles and access')
      .addTag('Bookings', 'PRD §6 — Full booking lifecycle')
      .addTag('Drivers', 'PRD §8, §44.1, §44.2 — Driver system and shifts')
      .addTag('Fleet', 'PRD §9 — Vehicles and fleet management')
      .addTag('Warehouses', 'PRD §10 — Warehouse structure')
      .addTag('Inventory', 'PRD §11 — Parcel tracking')
      .addTag('Scan', 'PRD §12 — Barcode scan system')
      .addTag('Waybills', 'PRD §14 — LR and waybill documents')
      .addTag('Payments', 'PRD §15 — M-Pesa, wallet, escrow')
      .addTag('Invoices', 'PRD §16 — Billing and invoice management')
      .addTag('RateCards', 'PRD §19 — Dynamic pricing engine')
      .addTag('Contracts', 'PRD §20 — B2B contract system')
      .addTag('SLA', 'PRD §21, §44.10 — SLA timers and escalation')
      .addTag('Notifications', 'PRD §22 — SMS, email, push')
      .addTag('Tracking', 'PRD §26 — Real-time GPS tracking')
      .addTag('Support', 'PRD §25, §36 — Customer support tickets')
      .addTag('Analytics', 'PRD §27A, §27B — Reporting and retention')
      .addTag('Audit', 'PRD §40 — Immutable audit trail')
      .addTag('Alerts', 'PRD §39 — Internal alert system')
      .addTag('Fraud', 'PRD §44.7 — Fraud detection engine')
      .addTag('SurgePricing', 'PRD §44.8 — Demand-supply surge engine')
      .addTag('RouteOptimization', 'PRD §44.17 — Route calculation')
      .addTag('Heatmap', 'PRD §44.21 — Driver demand heatmap')
      .addTag('Marketplace', 'PRD §44.20 — Partner aggregator mode')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // Keep JWT token across page refresh
        tagsSorter: 'alpha',
      },
    });
  }

  // ─── Graceful Shutdown (PRD §30) ──────────────────────────────────────────
  // Ensures in-flight requests complete before process exits
  // Required for RTO 4hr / RPO 1hr disaster recovery targets
  app.enableShutdownHooks();

  // ─── Start Server ──────────────────────────────────────────────────────────
  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ZITO Super App — Backend`);
  console.log(`  PRD: v10 ULTIMATE`);
  console.log(`  ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  URL: http://localhost:${port}/api/v1`);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`  Docs: http://localhost:${port}/api/docs`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

bootstrap();