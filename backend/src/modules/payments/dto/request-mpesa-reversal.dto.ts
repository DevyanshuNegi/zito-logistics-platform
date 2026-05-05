import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RequestMpesaReversalDto {
  @ApiProperty({
    description:
      'Reason recorded for an M-Pesa reversal request or finance-side recovery action',
  })
  @IsString()
  @MinLength(3)
  reason: string;
}
