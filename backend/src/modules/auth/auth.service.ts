import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(body: LoginDto) {
    if (!body) {
      throw new UnauthorizedException('Request body missing');
    }

    const { email, password } = body;

    // 1. Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({
      userId: user.id,
      email: user.email,
    });

    return {
      success: true,
      message: 'Login successful',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }
}