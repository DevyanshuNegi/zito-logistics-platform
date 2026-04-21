import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // §5.1 Validation — class-validator + class-transformer
  // Standard decorator-based validation for all DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // §5.1 API Documentation — Swagger / OpenAPI 3.0
  const config = new DocumentBuilder()
    .setTitle('ZITO — Logistics Super-App')
    .setDescription('Autoritative API documentation for the ZITO logistics ecosystem.')
    .setVersion('8.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // §5.3 Hosting & Infrastructure — Render.com sets the PORT
  const port = process.env.PORT || 3000;
  
  // Enable CORS for frontend static sites (§5.3)
  app.enableCors();

  await app.listen(port);
  console.log(`🚀 ZITO Backend v8.0 is running on: http://localhost:${port}`);
  console.log(`📖 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();