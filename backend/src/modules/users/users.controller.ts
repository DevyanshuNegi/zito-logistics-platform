import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadKycDto } from './dto/upload-kyc.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and account status (PRD §4)' })
  getProfile(@Req() req: any) {
    return this.usersService.findOne(req.user.id);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get current user language and currency preferences (PRD §23)' })
  getPreferences(@Req() req: any) {
    return this.usersService.getPreferences(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (PRD §4)' })
  updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update current user language and currency preferences (PRD §23)' })
  updatePreferences(@Req() req: any, @Body() dto: UpdateUserPreferencesDto) {
    return this.usersService.updatePreferences(req.user.id, dto);
  }

  @Post('me/kyc')
  @ApiOperation({ summary: 'Upload KYC document (PRD §4)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadKyc(
    @Req() req: any,
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadKycDto,
  ) {
    return this.usersService.uploadKycDocument(req.user.id, file, dto);
  }

  @Get('me/kyc')
  @ApiOperation({ summary: 'Get own KYC documents (PRD §4)' })
  getMyKyc(@Req() req: any) {
    return this.usersService.getKycDocuments(req.user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'List all users with pagination and filter (PRD §42)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('role') role?: UserRole,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      role,
      status,
      agencyId: req.user.role === UserRole.AGENCY_STAFF ? req.user.agencyId : undefined,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (PRD §42)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: update any user profile (PRD §42)' })
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin: change user role (PRD §2)' })
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate a user account (PRD §3)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.setStatus(id, 'ACTIVE' as any);
  }

  @Patch(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Suspend a user account (PRD §3)' })
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.setStatus(id, 'SUSPENDED' as any);
  }

  @Get(':id/kyc')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: view user KYC documents (PRD §4)' })
  getUserKyc(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getKycDocuments(id);
  }

  @Patch(':id/kyc/:documentId/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: approve or reject a KYC document (PRD §4)' })
  verifyKycDocument(
    @Param('id', ParseUUIDPipe) userId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; reason?: string },
  ) {
    return this.usersService.verifyKycDocument(
      userId,
      documentId,
      body.status,
      body.reason,
    );
  }
}
