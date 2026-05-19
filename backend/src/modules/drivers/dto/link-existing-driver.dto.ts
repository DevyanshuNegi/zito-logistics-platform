import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class LinkExistingDriverDto {
  @ApiProperty({
    example: '+254711000101',
    description:
      'Driver phone number already registered in the Zito Partners driver app.',
  })
  @IsString()
  phone: string;

  @ApiPropertyOptional({
    example: 'driver.partner@zito.local',
    description:
      'Optional secondary match key when the fleet owner also knows the driver email.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'c10f5ecb-29a2-4b39-8f8b-9d7da33d2fd1',
    description:
      'Internal-only owner account override for admin or agency staff linking on behalf of a fleet owner.',
  })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}
