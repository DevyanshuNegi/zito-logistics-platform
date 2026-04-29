import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RoutePointDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  sequence?: number;
}

export class CalculateRouteDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  stops: RoutePointDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RoutePointDto)
  currentLocation?: RoutePointDto;

  @IsOptional()
  @IsBoolean()
  optimizeStops?: boolean;

  @IsOptional()
  @IsBoolean()
  considerTraffic?: boolean;
}

export class RecalculateRouteDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RoutePointDto)
  currentLocation?: RoutePointDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  considerTraffic?: boolean;
}

export class DetectDeviationDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  thresholdKm?: number;
}
