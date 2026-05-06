import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateFreightMilestoneDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  blockedReason?: string;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
