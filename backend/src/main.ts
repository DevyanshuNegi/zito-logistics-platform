import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation pipe for DTO-driven request validation.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('ZITO - Logistics Super-App')
    .setDescription('Authoritative API documentation aligned to ZITO PRD v10 ULTIMATE.')
    .setVersion('PRD v10 ULTIMATE')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;

  // Enable CORS for frontend static sites.
  app.enableCors();

  await app.listen(port);
  console.log(`ZITO Backend is running on: http://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/docs`);
  console.log('PRD baseline: ZITO_PRD_v10_ULTIMATE');
}

bootstrap();
