import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ForceLogoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
