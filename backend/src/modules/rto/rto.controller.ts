import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RtoService } from './rto.service';
import {
  InitiateRtoDto,
  ReceiveRtoDto,
  RtoQueryDto,
  UpdateRtoStatusDto,
} from './dto/rto.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rto')
export class RtoController {
  constructor(private readonly rtoService: RtoService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Get()
  list(@Query() query: RtoQueryDto) {
    return this.rtoService.list(query);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rtoService.findOne(id);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Post()
  initiate(@Body() body: InitiateRtoDto) {
    return this.rtoService.initiate(body.bookingId, body.reason);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRtoStatusDto,
  ) {
    return this.rtoService.updateStatus(id, body.status);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Patch(':id/receive')
  receiveAtWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReceiveRtoDto,
  ) {
    return this.rtoService.receiveAtWarehouse(id, body.warehouseId);
  }
}
