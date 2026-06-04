import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

// Schema reality: No IdempotencyRecord model exists.
// Solution: in-memory Map with TTL (24h).
// For booking creation idempotency — the Booking.idempotencyKey @unique field
// in the schema handles DB-level idempotency. This interceptor provides the
// HTTP-level cached response layer so clients get back the same response
// without re-hitting business logic.
//
// Note: in-memory cache resets on server restart — acceptable for Phase 1.
// Phase 3: replace with Redis-backed store.

const KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const IN_FLIGHT_TIMEOUT_MS = 30_000;     // 30 seconds max for in-flight

interface CacheEntry {
  status: 'IN_FLIGHT' | 'DONE';
  response?: any;
  createdAt: number;
}

// Module-level singleton cache — survives across requests in same process
const responseCache = new Map<string, CacheEntry>();

// Cleanup expired entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.createdAt > KEY_TTL_MS) {
      responseCache.delete(key);
    }
  }
}, 30 * 60 * 1000);

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    // Only apply to mutating requests
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next.handle();
    }

    const key = (
      req.headers['idempotency-key'] ??
      req.headers['x-idempotency-key']
    ) as string | undefined;

    // Booking create and payment initiate REQUIRE the key
    const requiresKey = this.requiresIdempotencyKey(req.path);
    if (requiresKey && !key) {
      throw new BadRequestException(
        'Idempotency-Key header is required for this operation',
      );
    }

    if (!key) return next.handle();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(key)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID v4');
    }

    const cacheKey = `${req.user?.id ?? 'anon'}:${req.method}:${req.path}:${key}`;
    const existing = responseCache.get(cacheKey);

    if (existing) {
      const age = Date.now() - existing.createdAt;

      // Expired — remove and treat as fresh
      if (age > KEY_TTL_MS) {
        responseCache.delete(cacheKey);
      }
      // In-flight and still within timeout — reject duplicate
      else if (existing.status === 'IN_FLIGHT') {
        if (age < IN_FLIGHT_TIMEOUT_MS) {
          throw new ConflictException(
            'A request with this Idempotency-Key is already in progress',
          );
        }
        // Stale in-flight (>30s) — treat as fresh
        responseCache.delete(cacheKey);
      }
      // Already completed — return cached response
      else if (existing.status === 'DONE' && existing.response !== undefined) {
        return of(existing.response);
      }
    }

    // Mark as in-flight
    responseCache.set(cacheKey, { status: 'IN_FLIGHT', createdAt: Date.now() });

    return next.handle().pipe(
      tap((response) => {
        // Store completed response
        responseCache.set(cacheKey, {
          status: 'DONE',
          response,
          createdAt: Date.now(),
        });
      }),
    );
  }

  private requiresIdempotencyKey(path: string): boolean {
    return [
      '/customer/bookings',
      '/payments/initiate',
      '/wallet/debit',
      '/wallet/credit',
    ].some((p) => path.endsWith(p) || path.includes(p + '/'));
  }
}
