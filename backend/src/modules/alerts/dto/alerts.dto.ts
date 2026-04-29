import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TriggerAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;
}

export class ResolveAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
