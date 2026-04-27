import { IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsString()
  bookingId?: string;
}