import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OtpService } from './otp.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionStateService } from './session-state.service';
import { SessionGuard } from '../../common/guards/session.guard';
import { ReauthGuard } from '../../common/guards/reauth.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'zito-secure-secret-key',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    OtpService,
    RolesGuard,
    SessionStateService,
    SessionGuard,
    ReauthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
