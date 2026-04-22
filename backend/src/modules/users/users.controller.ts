import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  async create(@Body() data: any) {
    return this.usersService.create(data);
  }

  @Get(':id')
  @Roles('super_admin', 'operations_admin', 'finance_admin')
  @ApiOperation({ summary: 'Get a single user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data);
  }

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Lock a user record (prevents modification of key fields)' })
  async lock(@Param('id') id: string) {
    return this.usersService.toggleLock(id, true);
  }

  @Patch(':id/unlock')
  @ApiOperation({ summary: 'Unlock a user record' })
  async unlock(@Param('id') id: string) {
    return this.usersService.toggleLock(id, false);
  }
}