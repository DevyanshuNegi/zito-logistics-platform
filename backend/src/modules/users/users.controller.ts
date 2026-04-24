import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // Activated RolesGuard per PRD §3
@Controller('api/v1/admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('super_admin', 'operations_admin', 'finance_admin') // PRD: super and ops can view all users
  @ApiOperation({ summary: 'List all users with pagination and filtering' })
  async findAll(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @Post()
  @Roles('super_admin') // Only super admin can create users manually (for operations ops usually manage specific scoped data)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() data: any, @Req() req: any) {
    return this.usersService.create(data, req.user);
  }

  @Get(':id')
  @Roles('super_admin', 'operations_admin', 'finance_admin')
  @ApiOperation({ summary: 'Get a single user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('super_admin', 'operations_admin')
  @ApiOperation({ summary: 'Update a user by ID' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.usersService.update(id, data, req.user);
  }

  @Patch(':id/lock')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Lock a user record (prevents modification of key fields)' })
  async lock(@Param('id') id: string, @Req() req: any) {
    return this.usersService.toggleLock(id, true, req.user);
  }

  @Patch(':id/unlock')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Unlock a user record' })
  async unlock(@Param('id') id: string, @Req() req: any) {
    return this.usersService.toggleLock(id, false, req.user);
  }
}