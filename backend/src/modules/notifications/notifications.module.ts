import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SmsService } from './channels/sms.service';
import { EmailService } from './channels/email.service';
import { PushService } from './channels/push.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SmsService, EmailService, PushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
