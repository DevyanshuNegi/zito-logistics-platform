import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  agencyId?: string;

  @IsEnum(['COURIER', 'FTL', 'PTL'])
  serviceType: 'COURIER' | 'FTL' | 'PTL';

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsNumber()
  estimatedDistKm: number;
}