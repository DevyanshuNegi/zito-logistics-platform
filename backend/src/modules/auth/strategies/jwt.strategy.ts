import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AccountStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { SessionStateService } from '../session-state.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionStateService: SessionStateService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'zito-secure-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException();
    }

    await this.assertNotForceLoggedOut(user.id, payload.iat);
    await this.sessionStateService.assertActiveSession({
      sessionId: payload.sessionId,
      userId: user.id,
      issuedAt: payload.iat,
    });

    const baseUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      activeRole: user.role,
      agencyId: user.agencyId,
      sessionId: payload.sessionId ?? null,
      tokenIssuedAt: payload.iat ?? null,
    };

    if (user.role === 'DRIVER') {
      const driverProfile = await this.prisma.driver.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      return {
        ...baseUser,
        driverId: driverProfile?.id ?? null,
      };
    }

    return baseUser;
  }

  private async assertNotForceLoggedOut(userId: string, tokenIssuedAt?: number) {
    if (!tokenIssuedAt) {
      return;
    }

    const invalidation = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'USER',
        entityId: userId,
        action: 'FORCE_LOGOUT_ALL',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (invalidation && invalidation.createdAt.getTime() >= tokenIssuedAt * 1000) {
      throw new UnauthorizedException('Session was invalidated by a Super Admin.');
    }
  }
}
