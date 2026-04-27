import { IsString, IsNotEmpty } from 'class-validator';
import { KycDocumentDto } from './kyc-document.dto';
import { ApiProperty } from '@nestjs/swagger';

export class KycUploadDto extends KycDocumentDto {
  @ApiProperty({ example: 'user-uuid-1234', description: 'User ID associating this document' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}