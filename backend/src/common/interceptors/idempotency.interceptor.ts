import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (idempotencyKey) {
      if (this.cache.has(idempotencyKey)) {
        return of(this.cache.get(idempotencyKey));
      }
    }

    return next.handle().pipe(
      tap((data) => {
        if (idempotencyKey) {
          this.cache.set(idempotencyKey, data);
        }
      })
    );
  }
}