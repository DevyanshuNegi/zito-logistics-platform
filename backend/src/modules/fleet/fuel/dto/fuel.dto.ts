import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateFuelLogDto {
  @IsUUID()
  vehicleId: string;

  @IsUUID()
  @IsOptional()
  driverId?: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsNumber()
  @Min(0)
  fuelExpected: number;

  @IsNumber()
  @Min(0)
  fuelActual: number;

  @IsNumber()
  @Min(0)
  fuelCost: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class FuelLogQueryDto {
  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsUUID()
  @IsOptional()
  driverId?: string;

  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @IsString()
  @IsOptional()
  flagged?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
