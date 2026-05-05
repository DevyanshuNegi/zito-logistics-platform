import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewVehicleVerificationDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'] })
  @IsString()
  @IsIn(['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'])
  status!: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
