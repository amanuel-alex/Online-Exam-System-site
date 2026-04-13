import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Enterprise Performance & Request Logger
 * 
 * Tracks every incoming API request and records its execution duration (ms).
 * Provides the operational 'Heartbeat' for the Examina platform.
 * Essential for identifying bottlenecked endpoints (like Grading or Analytics)
 * before they impact national-scale availability.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP_MONITOR');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '-';
    
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const status = context.switchToHttp().getResponse().statusCode;
          this.logger.log(`[${method}] ${url} - ${status} (${duration}ms) - ${ip} - ${userAgent}`);
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const status = err.status || 500;
          this.logger.error(`[${method}] ${url} - ${status} (${duration}ms) - ERR: ${err.message}`);
        }
      })
    );
  }
}
