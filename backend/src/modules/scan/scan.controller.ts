import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ScanService } from './scan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER', 'TRANSPORTER')
  @Post()
  recordScan(@Body() data: any, @Req() req: any) {
    const performedBy = req.user.id;
    return this.scanService.recordScan(data, performedBy);
  }
}

