import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getUnread(@CurrentUser() user: any) {
    return this.notificationsService.getUnread(user.id);
  }

  @Post('test')
  testSend(@Body() data: any) {
    return this.notificationsService.send(data);
  }
}
