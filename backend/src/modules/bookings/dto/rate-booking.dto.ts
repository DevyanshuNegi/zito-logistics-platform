import { IsNumber, Min, Max, IsString, IsOptional } from 'class-validator';

export class RateBookingDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}