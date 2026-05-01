import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ScanService } from './scan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ConfirmDeliveryDto,
  RecordScanDto,
  ValidateScanDto,
  VehicleLoadDto,
  VehicleUnloadDto,
} from './dto/scan.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'DRIVER',
    'TRANSPORTER',
    'COURIER_COMPANY',
  )
  @Post('validate')
  validateMovement(@Body() data: ValidateScanDto, @Req() req: any) {
    return this.scanService.validateMovement(data, {
      viewerRole: req.user.activeRole ?? req.user.role,
      viewerUserId: req.user.id,
      viewerAgencyId: req.user.agencyId,
      viewerDriverId: req.user.driverId,
    });
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'DRIVER',
    'TRANSPORTER',
    'COURIER_COMPANY',
  )
  @Post()
  recordScan(@Body() data: RecordScanDto, @Req() req: any) {
    const performedBy = req.user.id;
    const activeRole = req.user.activeRole ?? req.user.role;
    if (activeRole === 'DRIVER') {
      data.driverId = req.user.driverId;
    }

    return this.scanService.recordScan(data, performedBy, {
      viewerRole: activeRole,
      viewerUserId: req.user.id,
      viewerAgencyId: req.user.agencyId,
      viewerDriverId: req.user.driverId,
    });
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'DRIVER',
    'TRANSPORTER',
    'COURIER_COMPANY',
  )
  @Post('vehicle-load')
  loadToVehicle(@Body() data: VehicleLoadDto, @Req() req: any) {
    const performedBy = req.user.id;
    return this.scanService.loadToVehicle(
      {
        ...data,
        driverId:
          (req.user.activeRole ?? req.user.role) === 'DRIVER'
            ? req.user.driverId
            : undefined,
      },
      performedBy,
      {
        viewerRole: req.user.activeRole ?? req.user.role,
        viewerUserId: req.user.id,
        viewerAgencyId: req.user.agencyId,
        viewerDriverId: req.user.driverId,
      },
    );
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'DRIVER',
    'TRANSPORTER',
    'COURIER_COMPANY',
  )
  @Post('vehicle-unload')
  unloadFromVehicle(@Body() data: VehicleUnloadDto, @Req() req: any) {
    const performedBy = req.user.id;
    return this.scanService.unloadFromVehicle(
      {
        ...data,
        driverId:
          (req.user.activeRole ?? req.user.role) === 'DRIVER'
            ? req.user.driverId
            : undefined,
      },
      performedBy,
      {
        viewerRole: req.user.activeRole ?? req.user.role,
        viewerUserId: req.user.id,
        viewerAgencyId: req.user.agencyId,
        viewerDriverId: req.user.driverId,
      },
    );
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'DRIVER', 'COURIER_COMPANY')
  @Post('confirm-delivery')
  confirmDelivery(@Body() data: ConfirmDeliveryDto, @Req() req: any) {
    const performedBy = req.user.id;
    return this.scanService.confirmDelivery(
      {
        ...data,
        driverId:
          (req.user.activeRole ?? req.user.role) === 'DRIVER'
            ? req.user.driverId
            : undefined,
      },
      performedBy,
      {
        viewerRole: req.user.activeRole ?? req.user.role,
        viewerUserId: req.user.id,
        viewerAgencyId: req.user.agencyId,
        viewerDriverId: req.user.driverId,
      },
    );
  }
}

