import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. Global Exception Filter (Standard format)
  app.useGlobalFilters(new AllExceptionsFilter());

  // 2. Global validation (Automated Sanitization & Type Conversion)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strips malicious/unexpected fields
    transform: true, 
    forbidNonWhitelisted: true, // Rejects requests with non-DTO fields
  }));

  // 3. Enable reading HTTP-only refresh tokens
  app.use(cookieParser());
  
  // 4. Strict CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || true, // Limit to specific frontend in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
  });

  // NOTE: Advanced security like Helmet or Rate-Limit guards 
  // should be enabled after installing the respective packages.
  // app.use(helmet());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
