import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/users/audit.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, AuditModule],
})
export class AppModule {}