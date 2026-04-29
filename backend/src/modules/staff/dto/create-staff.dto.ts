import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStaffDto {
  @IsUUID()
  userId: string;

  @IsString()
  role: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;
}
