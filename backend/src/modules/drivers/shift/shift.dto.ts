import { IsEnum, IsOptional } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class ShiftDto {
  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendance_status?: AttendanceStatus;
}