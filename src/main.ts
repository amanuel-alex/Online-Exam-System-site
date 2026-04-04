import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 0. Security Headers
  app.use(helmet());
  // This ensures future upgrades like /api/v2/ won't break existing national clients.
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 2. Global Exception Filter (Standard and Production-level logging)
  app.useGlobalFilters(new AllExceptionsFilter());

  // 3. Global validation (Automated Sanitization)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // 4. Enable reading HTTP-only refresh tokens
  app.use(cookieParser());
  
  // 5. Strict CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
