import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateInventoryItemDto,
  InventoryQueryDto,
  UpdateInventoryStatusDto,
} from './dto/inventory.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'WAREHOUSE_PARTNER')
  @Post()
  createItem(@Body() data: CreateInventoryItemDto, @Req() req: any) {
    return this.inventoryService.createItem(data, req.user.id);
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'WAREHOUSE_PARTNER',
    'TRANSPORTER',
    'CUSTOMER',
    'COURIER_COMPANY',
  )
  @Get()
  listItems(@Query() query: InventoryQueryDto, @Req() req: any) {
    const activeRole = req.user.activeRole ?? req.user.role;
    if (activeRole === 'CUSTOMER' || activeRole === 'COURIER_COMPANY') {
      query.ownerId = req.user.id;
    }

    return this.inventoryService.listItems(query);
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'WAREHOUSE_PARTNER',
    'TRANSPORTER',
    'CUSTOMER',
    'COURIER_COMPANY',
  )
  @Get('owner/:ownerId')
  filterByOwner(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Req() req: any,
  ) {
    const activeRole = req.user.activeRole ?? req.user.role;
    if (
      (activeRole === 'CUSTOMER' || activeRole === 'COURIER_COMPANY') &&
      req.user.id !== ownerId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    return this.inventoryService.filterByOwner(ownerId);
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'WAREHOUSE_PARTNER',
    'TRANSPORTER',
  )
  @Get('dispatch-order/:warehouseId')
  getDispatchOrder(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
  ) {
    return this.inventoryService.getDispatchOrder(warehouseId);
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'WAREHOUSE_PARTNER',
    'TRANSPORTER',
    'CUSTOMER',
    'COURIER_COMPANY',
  )
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const item = await this.inventoryService.getItemById(id);
    const activeRole = req.user.activeRole ?? req.user.role;

    if (
      (activeRole === 'CUSTOMER' || activeRole === 'COURIER_COMPANY') &&
      item.ownerId !== req.user.id
    ) {
      throw new ForbiddenException('Forbidden');
    }

    return item;
  }

  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'AGENCY_STAFF',
    'WAREHOUSE_PARTNER',
    'TRANSPORTER',
  )
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: UpdateInventoryStatusDto,
    @Req() req: any,
  ) {
    return this.inventoryService.updateItemStatus(
      id,
      updateData.status,
      updateData,
      req.user.id,
    );
  }
}

