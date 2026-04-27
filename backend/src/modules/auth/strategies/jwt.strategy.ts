import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'zito-secure-secret-key',
    });
  }

  /**
   * PRD §3 & §4: Real-time Account Lifecycle Validation.
   * Re-validates the user status against the database on every authenticated request.
   */
  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, phone: true, role: true, status: true },
    });

    if (!user) {
      throw new UnauthorizedException('User session invalid or user deleted');
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: `Access denied. Account is ${user.status.toLowerCase()}`,
        data: { status: user.status },
      });
    }

    return user;
  }
}
