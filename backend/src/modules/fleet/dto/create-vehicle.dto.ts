import { VehicleType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  plateNumber!: string;

  @IsString()
  chassisNumber!: string;

  @IsString()
  make!: string;

  @IsString()
  model!: string;

  @IsInt()
  @Min(1980)
  @Max(2100)
  year!: number;

  @IsEnum(VehicleType)
  type!: VehicleType;

  @IsNumber()
  @IsPositive()
  capacityKg!: number;

  @IsNumber()
  @IsPositive()
  capacityM3!: number;

  @IsString()
  insuranceCompany!: string;

  @IsString()
  insurancePolicyNumber!: string;

  @IsDateString()
  insuranceExpiry!: string;
}
