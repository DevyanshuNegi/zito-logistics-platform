import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestVerificationFeePaymentDto } from './dto/verification-fee.dto';

/**
 * PHASE 1 REVENUE STREAM #4: Verification Fees
 * 
 * How it works:
 * 1. Driver/Transporter initiates KYC (Know Your Customer) verification
 * 2. Standard verification (free): 7-10 business days
 * 3. Expedited verification (paid): 24 hours
 * 4. User pays fee: KES 500
 * 5. Priority processing trigger
 * 6. Receive certificate and badge
 * 
 * Revenue Model:
 * - Fee: KES 500 per expedited verification
 * - Assume 2,000 drivers/month × 30% expedite rate = 600 expedited/month
 * - Revenue: 600 × KES 500 = KES 300,000/month (Phase 1 target: KES 235M annual)
 * - Needs: Scale to 8,000+ drivers by end of Year 1
 * 
 * Business Value:
 * - Monetizes premium service
 * - Drives faster driver onboarding
 * - Increases platform quality/trust
 * - Creates "verified driver" competitive advantage
 */

export enum VerificationStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum VerificationProcessingMode {
  STANDARD = 'STANDARD', // 7-10 days, FREE
  EXPEDITED = 'EXPEDITED', // 24 hours, KES 500
}

@Injectable()
export class VerificationFeeService {
  private readonly logger = new Logger('VerificationFeeService');

  private readonly feeConfig = {
    EXPEDITED: 50000, // KES 500 in cents
  };

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Request expedited verification with payment
   * PHASE 1: Driver with pending verification clicks "Expedite" → Pay → Fast-track processing
   * 
   * Flow:
   * 1. User requests expedited verification
   * 2. Deduct KES 500 from wallet
   * 3. Create VerificationFeePayment record
   * 4. Trigger priority processing (move to front of queue)
   * 5. Send SMS confirmation + updated ETA
   * 
   * Prerequisites:
   * - User must have pending KYC documents
   * - User must have sufficient wallet balance
   * 
   * Error Cases:
   * - No pending verification: 404
   * - Already expedited: 409
   * - Already approved: 409
   * - Insufficient wallet: 402
   * 
   * Response:
   * - verificationFeeId: Payment record ID
   * - status: PAID or PENDING
   * - expiryDate: Expected completion (now + 24 hours)
   * - processingMode: EXPEDITED
   */
  async requestExpeditedVerification(userId: string, dto: RequestVerificationFeePaymentDto) {
    // Check if user has pending KYC verification
    const kycDocuments = await this.prisma.kycDocument.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
    });

    if (kycDocuments.length === 0) {
      throw new BadRequestException('No pending verification documents found');
    }

    // Check if already paid for expedited
    const existingPayment = await this.prisma.verificationFeePayment.findFirst({
      where: {
        userId,
        status: { in: ['PAID', 'PENDING'] },
      },
    });

    if (existingPayment) {
      throw new BadRequestException('You have already paid for expedited verification');
    }

    // Deduct fee from wallet
    try {
      const transaction = await this.payments.deductFromWallet(userId, {
        amount: this.feeConfig.EXPEDITED,
        type: 'VERIFICATION_FEE',
        description: 'Expedited KYC verification fee',
        reference: `VER-FEE-${userId.slice(0, 8)}`,
      });

      // Create verification fee payment record
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 1); // 24 hours from now

      const feePayment = await this.prisma.verificationFeePayment.create({
        data: {
          userId,
          amount: this.feeConfig.EXPEDITED,
          processingMode: VerificationProcessingMode.EXPEDITED,
          status: 'PAID',
          paidAt: new Date(),
          transactionReference: transaction.id,
          expectedCompletionDate: expiryDate,
        },
      });

      // Update KYC documents to UNDER_REVIEW (priority queue)
      await this.prisma.kycDocument.updateMany({
        where: {
          userId,
          status: 'PENDING',
        },
        data: {
          status: 'UNDER_REVIEW',
        },
      });

      // Send SMS confirmation
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      await this.notifications.sendSms(userId, {
        template: 'VERIFICATION_EXPEDITED_PAID',
        expectedDate: expiryDate.toLocaleDateString('en-KE'),
        expectedTime: expiryDate.toLocaleTimeString('en-KE'),
        reference: feePayment.id,
      });

      this.logger.log(
        `Expedited verification payment processed: ${feePayment.id} - KES ${this.feeConfig.EXPEDITED / 100}`,
      );

      return feePayment;
    } catch (error) {
      if (error.message?.includes('Insufficient balance')) {
        throw new BadRequestException(
          `Insufficient wallet balance. Need KES ${(this.feeConfig.EXPEDITED / 100).toLocaleString('en-KE')}`,
        );
      }
      throw error;
    }
  }

  /**
   * Complete verification and issue certificate
   * ADMIN/INTERNAL: Called by admin after reviewing KYC documents
   * Issues: Digital certificate + Badge on profile + Verification status
   */
  async approveVerification(userId: string, adminId: string): Promise<void> {
    // Update KYC documents
    const updated = await this.prisma.kycDocument.updateMany({
      where: { userId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('No KYC documents to verify');
    }

    // Update user verification status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'VERIFIED',
      },
    });

    // Issue verification certificate
    const certificate = await this.prisma.verificationCertificate.create({
      data: {
        userId,
        certificateNumber: `ZITO-${userId.slice(0, 8).toUpperCase()}-${Date.now()}`,
        issuedBy: adminId,
        issuedAt: new Date(),
        expiresAt: this.calculateCertificateExpiry(),
        status: 'ACTIVE',
      },
    });

    // Mark fee payment as completed (if expedited)
    await this.prisma.verificationFeePayment.updateMany({
      where: {
        userId,
        status: 'PAID',
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Send SMS with certificate details
    await this.notifications.sendSms(userId, {
      template: 'VERIFICATION_APPROVED',
      certificateNumber: certificate.certificateNumber,
      expiryDate: certificate.expiresAt.toLocaleDateString('en-KE'),
    });

    this.logger.log(`Verification approved for user ${userId}: Certificate ${certificate.certificateNumber}`);
  }

  /**
   * Reject verification
   * ADMIN/INTERNAL: Called by admin if documents are insufficient
   * Refund: Full refund of fee to wallet
   */
  async rejectVerification(userId: string, adminId: string, rejectionReason: string): Promise<void> {
    // Get expedited payment if it exists
    const feePayment = await this.prisma.verificationFeePayment.findFirst({
      where: {
        userId,
        status: 'PAID',
      },
    });

    // Refund if user paid for expedited
    if (feePayment) {
      await this.payments.refundToWallet(userId, {
        amount: feePayment.amount,
        type: 'VERIFICATION_FEE_REFUND',
        description: `Refund for rejected verification - ${rejectionReason}`,
        reference: `VER-REF-${feePayment.id.slice(0, 8)}`,
      });

      await this.prisma.verificationFeePayment.update({
        where: { id: feePayment.id },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
        },
      });
    }

    // Update KYC documents to rejected
    await this.prisma.kycDocument.updateMany({
      where: { userId },
      data: {
        status: 'REJECTED',
      },
    });

    // Send SMS with rejection details
    await this.notifications.sendSms(userId, {
      template: 'VERIFICATION_REJECTED',
      reason: rejectionReason,
      refundInfo: feePayment ? `Refunded KES ${(feePayment.amount / 100).toLocaleString('en-KE')}` : 'None',
    });

    this.logger.log(
      `Verification rejected for user ${userId}: ${rejectionReason}${feePayment ? ' (Refunded)' : ''}`,
    );
  }

  /**
   * Get verification status for user
   */
  async getVerificationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const feePayment = await this.prisma.verificationFeePayment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const certificate = await this.prisma.verificationCertificate.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    return {
      userId,
      overallStatus: user.status, // PENDING, VERIFIED, VERIFIED, REJECTED
      kycDocuments: user.kycDocuments.map((doc) => ({
        id: doc.id,
        type: doc.type,
        status: doc.status,
      })),
      expeditedPayment: feePayment
        ? {
            id: feePayment.id,
            status: feePayment.status,
            amount: feePayment.amount,
            paidAt: feePayment.paidAt,
            expectedCompletion: feePayment.expectedCompletionDate,
          }
        : null,
      certificate: certificate
        ? {
            number: certificate.certificateNumber,
            issuedAt: certificate.issuedAt,
            expiresAt: certificate.expiresAt,
          }
        : null,
    };
  }

  /**
   * Get verification fee pricing
   */
  async getVerificationFeeInfo() {
    return {
      standardMode: {
        processingTime: '7-10 business days',
        cost: 0,
        badge: 'Verified (Standard)',
      },
      expeditedMode: {
        processingTime: '24 hours',
        cost: this.feeConfig.EXPEDITED / 100, // KES
        costFormatted: `KES ${(this.feeConfig.EXPEDITED / 100).toLocaleString('en-KE')}`,
        badge: 'Verified (Expedited)',
      },
    };
  }

  /**
   * Helper: Calculate certificate expiry (1 year from now)
   */
  private calculateCertificateExpiry(): Date {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    return expiry;
  }
}
