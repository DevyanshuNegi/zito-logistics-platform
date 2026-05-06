import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT', // PRD compliant
}

export enum TicketCategory {
  BOOKING = 'BOOKING',
  PAYMENT = 'PAYMENT',
  DRIVER = 'DRIVER',
  GENERAL = 'GENERAL',
}

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  sourceContextType?: string;

  @IsOptional()
  @IsString()
  sourceContextId?: string;

  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  autobotSummary?: string;

  @IsOptional()
  @IsString()
  autobotArticle?: string;

  @IsOptional()
  @IsString()
  autobotConfidence?: string;

  @IsOptional()
  @IsString()
  autobotQuickAction?: string;

  @IsOptional()
  @IsString()
  autobotEscalationDesk?: string;

  @IsOptional()
  @IsString()
  autobotSuggestedReply?: string;
}
