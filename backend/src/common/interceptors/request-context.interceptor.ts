import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { RequestContextService } from '../request-context/request-context.service';

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContextService: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const correlationId =
      firstHeaderValue(request.headers['x-correlation-id']) ||
      firstHeaderValue(request.headers['x-request-id']) ||
      randomUUID();
    const requestId = firstHeaderValue(request.headers['x-request-id']) || randomUUID();
    const tenantId = firstHeaderValue(request.headers['x-tenant-id']);

    response.setHeader('X-Correlation-Id', correlationId);
    response.setHeader('X-Request-Id', requestId);
    if (tenantId) {
      response.setHeader('X-Tenant-Id', tenantId);
    }

    request.requestContext = {
      correlationId,
      requestId,
      tenantId,
      actorId: request.user?.id,
      actorRole: request.user?.role,
      source: 'api',
    };

    return this.requestContextService.run(
      request.requestContext,
      () => next.handle(),
    );
  }
}
