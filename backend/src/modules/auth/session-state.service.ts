import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type SessionRecord = {
  sessionId: string;
  userId: string;
  createdAtMs: number;
  lastActivityAtMs: number;
  ipAddress: string | null;
  deviceInfo: string | null;
  invalidatedAtMs: number | null;
  invalidationReason: string | null;
};

@Injectable()
export class SessionStateService {
  private readonly inactivityTimeoutMs =
    Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? 30) * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async restoreOrCreateSession(input: {
    sessionId: string;
    userId: string;
    issuedAt?: number | null;
    ipAddress?: string | null;
    deviceInfo?: string | null;
  }) {
    const key = this.keyOf(input.sessionId);
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key },
      select: {
        response: true,
      },
    });

    const parsed = this.asSessionRecord(existing?.response);
    if (parsed) {
      return parsed;
    }

    const createdAtMs = input.issuedAt ? input.issuedAt * 1000 : Date.now();
    const session: SessionRecord = {
      sessionId: input.sessionId,
      userId: input.userId,
      createdAtMs,
      lastActivityAtMs: createdAtMs,
      ipAddress: input.ipAddress ?? null,
      deviceInfo: input.deviceInfo ?? null,
      invalidatedAtMs: null,
      invalidationReason: null,
    };

    await this.prisma.idempotencyRecord.upsert({
      where: { key },
      create: {
        key,
        status: 'ACTIVE',
        requestHash: input.userId,
        response: session as Prisma.InputJsonValue,
        expiresAt: new Date(createdAtMs + this.inactivityTimeoutMs),
      },
      update: {
        status: 'ACTIVE',
        requestHash: input.userId,
        response: session as Prisma.InputJsonValue,
        expiresAt: new Date(createdAtMs + this.inactivityTimeoutMs),
      },
    });

    return session;
  }

  async assertActiveSession(input: {
    sessionId?: string | null;
    userId: string;
    issuedAt?: number | null;
  }) {
    if (!input.sessionId) {
      return;
    }

    const session = await this.restoreOrCreateSession({
      sessionId: input.sessionId,
      userId: input.userId,
      issuedAt: input.issuedAt ?? null,
    });

    if (session.userId !== input.userId) {
      throw new UnauthorizedException('Session owner mismatch.');
    }

    if (session.invalidatedAtMs) {
      throw new UnauthorizedException(
        session.invalidationReason ?? 'Session has been invalidated.',
      );
    }

    const now = Date.now();
    if (now - session.lastActivityAtMs > this.inactivityTimeoutMs) {
      await this.persistSession({
        ...session,
        lastActivityAtMs: now,
        invalidatedAtMs: now,
        invalidationReason: 'Session expired due to inactivity.',
      });
      throw new UnauthorizedException('Session expired due to inactivity.');
    }

    await this.persistSession({
      ...session,
      lastActivityAtMs: now,
    });
  }

  async invalidateAllUserSessions(userId: string, reason?: string) {
    const rows = await this.prisma.idempotencyRecord.findMany({
      where: {
        key: { startsWith: 'session:' },
        requestHash: userId,
      },
      select: {
        key: true,
        response: true,
      },
    });

    const now = Date.now();
    let invalidated = 0;

    for (const row of rows) {
      const session = this.asSessionRecord(row.response);
      if (!session || session.invalidatedAtMs) {
        continue;
      }

      await this.prisma.idempotencyRecord.update({
        where: { key: row.key },
        data: {
          status: 'INVALIDATED',
          response: {
            ...session,
            invalidatedAtMs: now,
            invalidationReason: reason ?? 'Session invalidated by Super Admin.',
          } as Prisma.InputJsonValue,
        },
      });
      invalidated += 1;
    }

    return invalidated;
  }

  getTimeoutMinutes() {
    return Math.round(this.inactivityTimeoutMs / 60000);
  }

  private async persistSession(session: SessionRecord) {
    await this.prisma.idempotencyRecord.upsert({
      where: { key: this.keyOf(session.sessionId) },
      create: {
        key: this.keyOf(session.sessionId),
        status: session.invalidatedAtMs ? 'INVALIDATED' : 'ACTIVE',
        requestHash: session.userId,
        response: session as Prisma.InputJsonValue,
        expiresAt: new Date(session.lastActivityAtMs + this.inactivityTimeoutMs),
      },
      update: {
        status: session.invalidatedAtMs ? 'INVALIDATED' : 'ACTIVE',
        requestHash: session.userId,
        response: session as Prisma.InputJsonValue,
        expiresAt: new Date(session.lastActivityAtMs + this.inactivityTimeoutMs),
      },
    });
  }

  private keyOf(sessionId: string) {
    return `session:${sessionId}`;
  }

  private asSessionRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, Prisma.JsonValue>;
    if (
      typeof record.sessionId !== 'string' ||
      typeof record.userId !== 'string' ||
      typeof record.createdAtMs !== 'number' ||
      typeof record.lastActivityAtMs !== 'number'
    ) {
      return null;
    }

    return {
      sessionId: record.sessionId,
      userId: record.userId,
      createdAtMs: record.createdAtMs,
      lastActivityAtMs: record.lastActivityAtMs,
      ipAddress: typeof record.ipAddress === 'string' ? record.ipAddress : null,
      deviceInfo: typeof record.deviceInfo === 'string' ? record.deviceInfo : null,
      invalidatedAtMs:
        typeof record.invalidatedAtMs === 'number' ? record.invalidatedAtMs : null,
      invalidationReason:
        typeof record.invalidationReason === 'string'
          ? record.invalidationReason
          : null,
    } satisfies SessionRecord;
  }
}
