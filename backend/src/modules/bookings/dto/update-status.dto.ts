import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export const DRIVER_ALLOWED_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus>> = {
  [BookingStatus.ASSIGNED]:               BookingStatus.ACCEPTED,
  [BookingStatus.ACCEPTED]:               BookingStatus.ARRIVED,
  [BookingStatus.ARRIVED]:                BookingStatus.PICKED,
  [BookingStatus.PICKED]:                 BookingStatus.IN_TRANSIT,
  [BookingStatus.IN_TRANSIT]:             BookingStatus.ARRIVED_AT_DESTINATION,
  [BookingStatus.ARRIVED_AT_DESTINATION]: BookingStatus.DELIVERY_VERIFICATION,
  [BookingStatus.DELIVERY_VERIFICATION]:  BookingStatus.DELIVERED,
};

export class UpdateStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  deliveryProofUrl?: string;

  @IsString()
  @IsOptional()
  deliveryOtp?: string;
}