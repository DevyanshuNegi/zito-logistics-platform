import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
  correlationId: string;
  requestId: string;
  tenantId?: string;
  actorId?: string;
  actorRole?: string;
  source: 'api' | 'system';
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  getCorrelationId() {
    return this.get()?.correlationId;
  }

  systemContext(correlationId: string): RequestContext {
    return {
      correlationId,
      requestId: correlationId,
      source: 'system',
    };
  }
}
