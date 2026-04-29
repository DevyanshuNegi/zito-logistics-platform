import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RegisterDriverReferralDto {
  @IsOptional()
  @IsUUID()
  referrerDriverId?: string;

  @IsUUID()
  referredUserId: string;

  @IsOptional()
  @IsString()
  note?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  referrerBonusAmount?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  joiningBonusAmount?: number;
}

export class ConvertDriverReferralDto {
  @IsOptional()
  @IsString()
  note?: string;
}
