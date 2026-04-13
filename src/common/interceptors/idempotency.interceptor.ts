import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['x-idempotency-key'];

    // Only apply if the key is provided and it's a mutation (POST/PATCH/PUT)
    if (!idempotencyKey || !['POST', 'PATCH', 'PUT'].includes(request.method)) {
      return next.handle();
    }

    const user = request.user;
    if (!user) throw new BadRequestException('User context required for idempotency.');

    // Check if key exists
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      if (existing.userId !== user.id) {
        throw new BadRequestException('Idempotency key mismatch.');
      }
      if (existing.response) {
        // Return cached response
        return of(existing.response);
      } else {
        // Request in progress
        throw new ConflictException('A request with this idempotency key is already in progress.');
      }
    }

    // Create key entry (Lock)
    await this.prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
      },
    });

    return next.handle().pipe(
      tap(async (response) => {
        // Store response for future requests
        await this.prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: { response: response || {} },
        });
      }),
    );
  }
}
