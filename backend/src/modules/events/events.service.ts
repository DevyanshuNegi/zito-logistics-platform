import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  EnterpriseEventEnvelope,
  EnterpriseEventPayload,
  ENTERPRISE_EVENT_TYPES,
} from './events.types';

type EventHandler = (event: EnterpriseEventEnvelope) => void | Promise<void>;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly deliveredKeys = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  getSupportedEvents() {
    return [...ENTERPRISE_EVENT_TYPES];
  }

  subscribe(eventType: EnterpriseEventPayload['eventType'], handler: EventHandler) {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);

    return () => handlers.delete(handler);
  }

  async publish(input: EnterpriseEventPayload) {
    const context = this.requestContextService.get();
    const event: EnterpriseEventEnvelope = {
      ...input,
      eventId: input.eventId ?? randomUUID(),
      correlationId: input.correlationId ?? context?.correlationId ?? randomUUID(),
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      actorId: input.actorId ?? context?.actorId,
      tenantId: input.tenantId ?? context?.tenantId,
      deliveryMode: this.externalBrokerConfigured() ? 'external-adapter' : 'in-process',
    };

    const deliveryKey =
      event.idempotencyKey ?? `${event.eventType}:${event.aggregateType}:${event.aggregateId}:${event.eventId}`;
    if (this.deliveredKeys.has(deliveryKey)) {
      return { delivered: false, duplicate: true, event };
    }
    this.deliveredKeys.add(deliveryKey);

    await this.writeEventAudit(event);
    await this.deliverInProcess(event);
    await this.forwardToExternalBroker(event);

    return { delivered: true, duplicate: false, event };
  }

  private async deliverInProcess(event: EnterpriseEventEnvelope) {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers?.size) {
      return;
    }

    await Promise.allSettled(
      [...handlers].map(async (handler) => {
        await handler(event);
      }),
    );
  }

  private async writeEventAudit(event: EnterpriseEventEnvelope) {
    try {
      await this.prisma.internalAlert.create({
        data: {
          type: 'SYSTEM_EVENT',
          severity: 'LOW',
          status: 'RESOLVED',
          entityType: event.aggregateType,
          entityId: event.aggregateId,
          message: `${event.eventType} recorded for ${event.aggregateType} ${event.aggregateId}.`,
          metadata: {
            eventId: event.eventId,
            eventType: event.eventType,
            correlationId: event.correlationId,
            tenantId: event.tenantId ?? null,
            actorId: event.actorId ?? null,
            idempotencyKey: event.idempotencyKey ?? null,
            occurredAt: event.occurredAt,
            deliveryMode: event.deliveryMode,
            data: event.data ?? {},
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Event audit write failed for ${event.eventType}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async forwardToExternalBroker(event: EnterpriseEventEnvelope) {
    if (!this.externalBrokerConfigured()) {
      return;
    }

    // Adapter hook for RabbitMQ/Kafka extraction. Current delivery remains in-process
    // so existing booking, payment, and OTP flows are not coupled to a broker.
    this.logger.debug(
      `External event broker configured; ${event.eventType} is ready for adapter forwarding.`,
    );
  }

  private externalBrokerConfigured() {
    return Boolean(process.env.RABBITMQ_URL || process.env.KAFKA_BROKERS);
  }
}
