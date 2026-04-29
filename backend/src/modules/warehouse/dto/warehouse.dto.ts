import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  agencyId: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;
}

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  agencyId?: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;
}

export class CreateWarehouseZoneDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  capacity: number;
}

export class CreateWarehouseRackDto {
  @IsString()
  label: string;
}

export class CreateWarehouseBinDto {
  @IsString()
  label: string;
}
