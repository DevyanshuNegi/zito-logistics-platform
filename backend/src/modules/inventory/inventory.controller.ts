import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards, Req } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Post()
  createItem(@Body() data: any, @Req() req: any) {
    if (!data.ownerId) {
      data.ownerId = req.user.id; // Usually it's linked to the customer 
    }
    return this.inventoryService.createItem(data);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF', 'CUSTOMER')
  @Get('owner/:ownerId')
  filterByOwner(@Param('ownerId') ownerId: string, @Req() req: any) {
    if (req.user.role === 'CUSTOMER' && req.user.id !== ownerId) {
      return { _error: 'Forbidden' };
    }
    return this.inventoryService.filterByOwner(ownerId);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Get('dispatch-order/:warehouseId')
  getDispatchOrder(@Param('warehouseId') warehouseId: string) {
    return this.inventoryService.getDispatchOrder(warehouseId);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'AGENCY_STAFF')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @Body() updateData: any) {
    return this.inventoryService.updateItemStatus(id, status, updateData);
  }
}

