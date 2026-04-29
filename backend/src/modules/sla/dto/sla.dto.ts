import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class StartSlaTimerDto {
  @ApiPropertyOptional({ enum: ServiceType, description: 'Optional override for service type configuration lookup.' })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}

export class DetectSlaBreachDto {
  @ApiPropertyOptional({ default: false, description: 'Auto-handle driver no-show when the breached stage qualifies.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoHandleNoShow?: boolean;
}

export class ScanSlaBreachesDto extends DetectSlaBreachDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
