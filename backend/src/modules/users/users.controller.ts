import {
  Controller, Get, Patch, Post,
  Body, Param, Query, Req, UseGuards,
  UploadedFile, UseInterceptors, ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadKycDto } from './dto/upload-kyc.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

// PRD §4 — Inline Multer type (avoids @types/multer dependency)
interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── SELF — Any Authenticated User ────────────────────────────────────────

  // PRD §4 — Get own profile; used by pending-approval screen to poll status
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and account status (PRD §4)' })
  getProfile(@Req() req: any) {
    return this.usersService.findOne(req.user.id);
  }

  // PRD §4 — Update own profile fields (name, email, phone)
  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (PRD §4)' })
  updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto);
  }

  // PRD §4 — Upload KYC document; sets compliance status to PENDING
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

  // PRD §4 — Get own KYC documents and verification status
  @Get('me/kyc')
  @ApiOperation({ summary: 'Get own KYC documents (PRD §4)' })
  getMyKyc(@Req() req: any) {
    return this.usersService.getKycDocuments(req.user.id);
  }

  // ─── ADMIN — User Management (PRD §42) ────────────────────────────────────

  // PRD §42 — List users: ADMIN sees all, AGENCY_STAFF sees their agency only
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'List all users with pagination and filter (PRD §42)' })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'role',   required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(
    @Req() req: any,
    @Query('page')   page   = '1',
    @Query('limit')  limit  = '20',
    @Query('role')   role?: UserRole,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll({
      page:     Number(page),
      limit:    Math.min(Number(limit), 100), // PRD §28: max page size 100
      role,
      status,
      agencyId: req.user.role === UserRole.AGENCY_STAFF ? req.user.agencyId : undefined,
    });
  }

  // PRD §42 — Get a specific user by ID (ADMIN/SUPER_ADMIN only)
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (PRD §42)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // PRD §42 — Admin update any user profile (not role — use /role endpoint)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: update any user profile (PRD §42)' })
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // PRD §2 — SUPER_ADMIN only: change user role (high-risk operation)
  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin: change user role (PRD §2)' })
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }

  // PRD §3 — Activate user after KYC approval
  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate a user account (PRD §3)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.setStatus(id, 'ACTIVE' as any);
  }

  // PRD §3 — Suspend user; blocks login and all platform activity immediately
  @Patch(':id/suspend')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Suspend a user account (PRD §3)' })
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.setStatus(id, 'SUSPENDED' as any);
  }

  // PRD §4 — Admin view user KYC documents for verification
  @Get(':id/kyc')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: view user KYC documents (PRD §4)' })
  getUserKyc(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getKycDocuments(id);
  }

  // PRD §4 — Admin approve or reject a specific KYC document
  @Patch(':id/kyc/:documentId/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: approve or reject a KYC document (PRD §4)' })
  verifyKycDocument(
    @Param('id',         ParseUUIDPipe) userId:     string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; reason?: string },
  ) {
    return this.usersService.verifyKycDocument(userId, documentId, body.status, body.reason);
  }
}