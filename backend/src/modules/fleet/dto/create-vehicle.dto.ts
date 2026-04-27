import { IsString, IsBoolean, IsNumber } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  plateNumber: string;

  @IsString()
  model: string;

  @IsNumber()
  capacityKg: number;
}