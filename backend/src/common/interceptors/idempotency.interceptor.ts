import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

// In-Memory map for Idempotency (since PRD v10 relies on Redis eventually,
// and idempotencyRecord is absent from Prisma schema).
const IDEMPOTENCY_STORE = new Map<string, { status: string; response?: any }>();

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey || request.method === 'GET') {
      return next.handle();
    }

    const existingRecord = IDEMPOTENCY_STORE.get(idempotencyKey);
    if (existingRecord) {
      if (existingRecord.status === 'PROCESSING') {
        throw new ConflictException('A request with this idempotency key is currently processing');
      }
      // Return cached response
      return of(existingRecord.response);
    }

    // Mark as processing
    IDEMPOTENCY_STORE.set(idempotencyKey, { status: 'PROCESSING' });

    return next.handle().pipe(
      tap((response) => {
        IDEMPOTENCY_STORE.set(idempotencyKey, { status: 'COMPLETED', response });
        // Optional: clear memory after 24h
        setTimeout(() => IDEMPOTENCY_STORE.delete(idempotencyKey), 24 * 60 * 60 * 1000);
      }),
    );
  }
}
