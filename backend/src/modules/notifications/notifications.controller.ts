import { Controller, Get, Patch, Param, Req, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * PRD §22: Get own notifications with pagination.
   */
  @Get()
  @ApiOperation({ summary: 'Get own notifications (PRD §22)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getNotifications(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.notificationsService.getUserNotifications(
      req.user.id,
      Number(page),
      Math.min(Number(limit), 100),
    );
  }

  /**
   * PRD §22: Mark a single notification as read.
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read (PRD §22)' })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  /**
   * PRD §22: Mark all notifications as read.
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read (PRD §22)' })
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}