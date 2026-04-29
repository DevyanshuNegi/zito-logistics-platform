import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewFraudFlagDto {
  @IsIn(['REVIEWED', 'CONFIRMED', 'FALSE_POSITIVE'])
  status: 'REVIEWED' | 'CONFIRMED' | 'FALSE_POSITIVE';

  @IsOptional()
  @IsString()
  note?: string;
}
