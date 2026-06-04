import { IsString, IsEnum, IsOptional } from 'class-validator';

export class RequestVerificationFeePaymentDto {
  @IsOptional()
  @IsString()
  reason?: string; // Why they want expedited
}

export class ApproveVerificationDto {
  @IsString()
  adminId: string;
}

export class RejectVerificationDto {
  @IsString()
  adminId: string;

  @IsString()
  rejectionReason: string;
}

export class VerificationFeeResponseDto {
  id: string;
  userId: string;
  amount: number; // KES in cents
  status: 'PAID' | 'PENDING' | 'COMPLETED' | 'REFUNDED';
  processingMode: 'STANDARD' | 'EXPEDITED';
  paidAt: Date;
  expectedCompletionDate?: Date;
}
