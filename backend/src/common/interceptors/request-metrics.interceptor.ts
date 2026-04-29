import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { RequestMetricsService } from '../monitoring/request-metrics.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly requestMetricsService: RequestMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.requestMetricsService.record({
          method: request.method,
          path: request.route?.path ?? request.url,
          statusCode: response.statusCode ?? 200,
          durationMs: Date.now() - startedAt,
          failed: (response.statusCode ?? 200) >= 400,
        });
      }),
      catchError((error) => {
        this.requestMetricsService.record({
          method: request.method,
          path: request.route?.path ?? request.url,
          statusCode: error?.status ?? 500,
          durationMs: Date.now() - startedAt,
          failed: true,
        });
        return throwError(() => error);
      }),
    );
  }
}
