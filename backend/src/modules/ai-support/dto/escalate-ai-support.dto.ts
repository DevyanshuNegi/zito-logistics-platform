import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketCategory, TicketPriority } from '../../support/dto/create-ticket.dto';

export class EscalateAiSupportDto {
  @IsString()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  sourceContextType?: string;

  @IsOptional()
  @IsString()
  sourceContextId?: string;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  aiSummary?: string;

  @IsOptional()
  @IsString()
  aiConfidence?: string;

  @IsOptional()
  @IsString()
  aiEscalationDesk?: string;

  @IsOptional()
  @IsString()
  aiSuggestedReply?: string;
}
