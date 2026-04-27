import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateAgencyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
