import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'zito-secure-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException();
    }

    const baseUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      activeRole: user.role,
      agencyId: user.agencyId,
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
}
