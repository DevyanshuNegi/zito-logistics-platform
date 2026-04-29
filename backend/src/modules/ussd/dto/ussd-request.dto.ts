import { IsOptional, IsString } from 'class-validator';

export class UssdRequestDto {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  text?: string;
}
