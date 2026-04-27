import { IsString, IsNotEmpty } from 'class-validator';

export class UploadKycDto {
  @IsString()
  @IsNotEmpty()
  documentType: string;
}