import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AssignDriverDto {
  @IsUUID()
  driverId: string;

  @IsUUID()
  vehicleId: string;

  @IsString()
  @IsOptional()
  note?: string;
}