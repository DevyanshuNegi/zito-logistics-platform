import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getUnread(@Req() req: any) {
    const user = req.user;
    return this.notificationsService.getUserNotifications(user.id);
  }

  @Roles('ADMIN', 'SUPER_ADMIN')
  @Post()
  send(@Body() data: any) {
    return this.notificationsService.create(data);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }
}

