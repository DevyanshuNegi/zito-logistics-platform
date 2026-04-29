import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type BonusType = 'JOINING_BONUS' | 'REFERRAL_BONUS';

@Injectable()
export class IncentivesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: { driverId?: string; type?: string } = {}) {
    const incentives = await this.prisma.driverIncentive.findMany({
      where: {
        ...(filters.driverId && { driverId: filters.driverId }),
        ...(filters.type && { type: filters.type }),
      },
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      incentives,
      total: incentives.length,
    };
  }

  async grantJoiningBonus(
    input: {
      driverId: string;
      amount: number;
      reason?: string | null;
      reference?: string | null;
      bookingId?: string | null;
    },
    actorId: string,
  ) {
    return this.grantDriverBonus(
      {
        ...input,
        type: 'JOINING_BONUS',
        reason:
          input.reason?.trim() || 'Driver joining bonus credited after activation.',
      },
      actorId,
    );
  }

  async grantReferralBonus(
    input: {
      driverId: string;
      amount: number;
      reason?: string | null;
      reference?: string | null;
      bookingId?: string | null;
    },
    actorId: string,
  ) {
    return this.grantDriverBonus(
      {
        ...input,
        type: 'REFERRAL_BONUS',
        reason:
          input.reason?.trim() || 'Driver referral bonus credited after activation.',
      },
      actorId,
    );
  }

  private async grantDriverBonus(
    input: {
      driverId: string;
      amount: number;
      type: BonusType;
      reason: string;
      reference?: string | null;
      bookingId?: string | null;
    },
    actorId: string,
  ) {
    if (input.amount <= 0) {
      throw new BadRequestException('Bonus amount must be greater than zero.');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            status: true,
          },
        },
      },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    if (driver.user.role !== UserRole.DRIVER) {
      throw new BadRequestException('Bonus target must be a DRIVER account.');
    }

    const idempotencyKey = input.reference
      ? `driver-bonus:${input.type}:${input.reference}:${input.driverId}`
      : null;

    if (idempotencyKey) {
      const existing = await this.prisma.walletTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          incentive: await this.prisma.driverIncentive.findFirst({
            where: {
              driverId: input.driverId,
              type: input.type,
              reason: input.reason,
            },
            orderBy: { createdAt: 'desc' },
          }),
          walletTransaction: existing,
          reused: true,
        };
      }
    }

    const wallet = await this.ensureWallet(driver.userId);
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: input.amount } },
      });

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: input.type,
          amount: input.amount,
          balance: updatedWallet.balance,
          reference: input.reference ?? null,
          description: input.reason,
          bookingId: input.bookingId ?? null,
          idempotencyKey: idempotencyKey ?? undefined,
        },
      });

      const incentive = await tx.driverIncentive.create({
        data: {
          driverId: input.driverId,
          type: input.type,
          amount: input.amount,
          reason: input.reason,
          bookingId: input.bookingId ?? null,
        },
      });

      return { incentive, walletTransaction, wallet: updatedWallet };
    });

    await this.writeAudit(
      actorId,
      input.type === 'JOINING_BONUS'
        ? 'DRIVER_JOINING_BONUS_GRANTED'
        : 'DRIVER_REFERRAL_BONUS_GRANTED',
      input.driverId,
      {
        amount: input.amount,
        reference: input.reference ?? null,
        walletBalance: result.wallet.balance,
      },
    );

    return {
      ...result,
      reused: false,
    };
  }

  private async ensureWallet(userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId },
    });
    if (wallet) {
      return wallet;
    }

    return this.prisma.wallet.create({
      data: {
        userId,
        balance: 0,
        currency: 'KES',
      },
    });
  }

  private async writeAudit(
    userId: string,
    action: string,
    entityId: string,
    details: Record<string, unknown>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'DRIVER_INCENTIVE',
        entityId,
        details: details as Prisma.InputJsonValue,
      },
    });
  }
}
