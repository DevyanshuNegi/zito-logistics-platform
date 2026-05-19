import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiSupportFeedbackDto {
  @IsBoolean()
  helpful: boolean;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
