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
import { TwilioOtpProvider } from './otp/twilio.provider';
import { TestOtpProvider } from './otp/test.provider';
import { FirebaseOtpProvider } from './otp/firebase.provider';
import { AfricasTalkingOtpProvider } from './otp/africastalking.provider';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET as string,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    OtpService,
    TwilioOtpProvider,
    TestOtpProvider,
    FirebaseOtpProvider,
    AfricasTalkingOtpProvider,
    RolesGuard,
    SessionStateService,
    SessionGuard,
    ReauthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
