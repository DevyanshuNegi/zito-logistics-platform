import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class SetHeatmapThresholdsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  low: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  medium: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  high: number;
}
