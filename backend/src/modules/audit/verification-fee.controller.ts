import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { VerificationFeeService } from './verification-fee.service';
import { RequestVerificationFeePaymentDto } from './dto/verification-fee.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard'; // Assumes this exists

@Controller('verification')
@UseGuards(JwtAuthGuard)
export class VerificationFeeController {
  constructor(private readonly verificationFee: VerificationFeeService) {}

  /**
   * Get verification fee pricing info
   * PUBLIC: Anyone can view pricing
   * Response: Pricing tiers (standard free 7-10 days, expedited KES 500 for 24 hours)
   */
  @Get('pricing')
  async getVerificationPricing() {
    return this.verificationFee.getVerificationFeeInfo();
  }

  /**
   * Get current verification status
   * AUTHENTICATED: User can check their own status
   * Response: KYC documents, fees paid, certificate info
   */
  @Get('status')
  async getVerificationStatus(@Req() req: any) {
    const userId = req.user.id;
    return this.verificationFee.getVerificationStatus(userId);
  }

  /**
   * Request expedited verification (paid)
   * PHASE 1: Driver has pending KYC → Clicks "Expedite" → Pays KES 500 → Fast-tracked to 24 hours
   * 
   * Prerequisites:
   * - User must have pending KYC documents
   * - User must have sufficient wallet balance (KES 500)
   * 
   * Flow:
   * 1. User submits KYC documents (separate process)
   * 2. Standard verification: 7-10 business days (FREE)
   * 3. Or click "Expedite Verification" → Pay KES 500
   * 4. POST /verification/expedite with optional reason
   * 5. Deduct KES 500 from wallet
   * 6. Move to priority processing queue
   * 7. Receive in 24 hours
   * 
   * Response:
   * - verificationFeeId: Payment record ID
   * - status: PAID
   * - expectedCompletionDate: Now + 24 hours
   * - estimatedCost: KES 500
   * 
   * Error Cases:
   * - No pending verification: 404
   * - Already expedited: 409
   * - Insufficient wallet: 402 Payment Required
   * - Already verified: 409
   */
  @Post('expedite')
  async requestExpeditedVerification(
    @Req() req: any,
    @Body() dto: RequestVerificationFeePaymentDto,
  ) {
    const userId = req.user.id;
    return this.verificationFee.requestExpeditedVerification(userId, dto);
  }

  /**
   * Approve verification (admin endpoint)
   * ADMIN ONLY: Called after reviewing KYC documents
   * 
   * Effects:
   * - Mark user as VERIFIED
   * - Issue digital certificate
   * - Add verified badge to profile
   * - Refund fee if rejected docs are resubmitted
   * 
   * Response:
   * - success: true
   * - certificateNumber: Digital certificate ID
   * - message: "Verification approved"
   */
  @Post('approve')
  @UseGuards(AdminGuard)
  async approveVerification(
    @Req() req: any,
    @Body() body: { userId: string },
  ) {
    const adminId = req.user.id;
    await this.verificationFee.approveVerification(body.userId, adminId);
    return { success: true, message: 'Verification approved and certificate issued' };
  }

  /**
   * Reject verification (admin endpoint)
   * ADMIN ONLY: Called if KYC documents are insufficient
   * 
   * Effects:
   * - Mark user verification as REJECTED
   * - Refund expedited fee if paid
   * - Send rejection reason + instructions
   * - User can resubmit documents
   * 
   * Response:
   * - success: true
   * - refund: Amount refunded (or 0)
   * - message: "Verification rejected"
   */
  @Post('reject')
  @UseGuards(AdminGuard)
  async rejectVerification(
    @Req() req: any,
    @Body() body: { userId: string; rejectionReason: string },
  ) {
    const adminId = req.user.id;
    await this.verificationFee.rejectVerification(body.userId, adminId, body.rejectionReason);
    return { success: true, message: 'Verification rejected with refund' };
  }
}
