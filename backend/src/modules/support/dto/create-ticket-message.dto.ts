import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
