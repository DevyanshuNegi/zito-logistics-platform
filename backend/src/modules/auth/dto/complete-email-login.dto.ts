import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CompleteEmailLoginDto {
  @ApiProperty({
    example: 'password123',
    description: 'Password entered after email OTP verification',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
