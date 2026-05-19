import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ChatAiSupportDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  screenContext?: string;
}
