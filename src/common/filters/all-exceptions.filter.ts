import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any).message || exception.message
        : 'Internal server error';

    const error =
      exception instanceof HttpException
        ? (exception.getResponse() as any).error || 'Error'
        : 'Internal Server Error';

    // Log the error for internal auditing (not shown to users in production)
    if (status >= 500) {
      this.logger.error(`[${request.method}] ${request.url} - Error: ${message}`, (exception as any).stack);
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message, // Flattens class-validator arrays
      error: error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
