import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export const APPROVAL_ACTION_TYPES = [
  'PAYMENT_REFUND',
  'PAYOUT_OVERRIDE',
  'BOOKING_CANCEL',
] as const;

export type ApprovalActionType = (typeof APPROVAL_ACTION_TYPES)[number];

export class ApprovalListQueryDto {
  @ApiPropertyOptional({ enum: APPROVAL_ACTION_TYPES })
  @IsOptional()
  @IsIn(APPROVAL_ACTION_TYPES)
  actionType?: ApprovalActionType;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  status?: string;
}

export class RequestRefundApprovalDto {
  @IsUUID()
  paymentId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class RequestBookingCancelApprovalDto {
  @IsUUID()
  bookingId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  penaltyOverrideNote?: string;
}

export class RequestPayoutOverrideApprovalDto {
  @IsUUID()
  payrollId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overrideAmount!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ReviewApprovalDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
