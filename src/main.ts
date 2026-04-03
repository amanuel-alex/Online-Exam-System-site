import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. Global Exception Filter (Standard format)
  app.useGlobalFilters(new AllExceptionsFilter());

  // 2. Global validation (strip unexpected fields & transform types)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // 3. Enable reading HTTP-only refresh tokens
  app.use(cookieParser());
  
  // 4. CORS configuration for frontend
  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
