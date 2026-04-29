import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';

type TelemetryEvent = {
  title: string;
  message: string;
  level: 'error' | 'warning' | 'info';
  source: string;
  tags?: string[];
  payload?: Record<string, unknown>;
};

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  async captureException(input: {
    message: string;
    statusCode: number;
    path: string;
    method: string;
    timestamp: string;
  }) {
    if (input.statusCode < 500) {
      return;
    }

    await this.captureEvent({
      title: `Unhandled ${input.statusCode} response`,
      message: `${input.method} ${input.path} failed with ${input.statusCode}: ${input.message}`,
      level: 'error',
      source: 'global-exception-filter',
      tags: ['api', 'exception', String(input.statusCode)],
      payload: input,
    });
  }

  async captureEvent(event: TelemetryEvent) {
    await Promise.allSettled([
      this.sendToSentry(event),
      this.sendToDatadog(event),
    ]);
  }

  private async sendToSentry(event: TelemetryEvent) {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      return;
    }

    try {
      const parsed = new URL(dsn);
      const projectId = parsed.pathname.replace(/^\/+/, '');
      if (!projectId) {
        throw new Error('Missing Sentry project id in DSN.');
      }

      const envelopeUrl = `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`;
      const payload = JSON.stringify({
        event_id: randomUUID().replace(/-/g, ''),
        message: event.message,
        level: event.level,
        tags: {
          source: event.source,
          ...(event.tags?.length ? { labels: event.tags.join(',') } : {}),
        },
        extra: {
          title: event.title,
          ...(event.payload ?? {}),
        },
        timestamp: new Date().toISOString(),
      });

      const envelope = `${JSON.stringify({ dsn })}\n${JSON.stringify({ type: 'event' })}\n${payload}`;
      await axios.post(envelopeUrl, envelope, {
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
        },
        timeout: 3000,
      });
    } catch (error) {
      this.logger.warn(
        `Sentry forwarding failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async sendToDatadog(event: TelemetryEvent) {
    const apiKey = process.env.DATADOG_API_KEY || process.env.DD_API_KEY;
    if (!apiKey) {
      return;
    }

    const site = process.env.DATADOG_SITE || 'datadoghq.com';
    try {
      await axios.post(
        `https://api.${site}/api/v1/events`,
        {
          title: event.title,
          text: event.message,
          alert_type:
            event.level === 'error'
              ? 'error'
              : event.level === 'warning'
                ? 'warning'
                : 'info',
          source_type_name: event.source,
          tags: event.tags ?? [],
        },
        {
          headers: {
            'DD-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 3000,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Datadog forwarding failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
