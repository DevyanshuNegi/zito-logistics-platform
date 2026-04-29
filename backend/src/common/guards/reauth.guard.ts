import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { REAUTH_KEY } from '../decorators/reauth.decorator';

@Injectable()
export class ReauthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresReauth = this.reflector.getAllAndOverride<boolean>(REAUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresReauth) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token =
      request.headers['x-reauth-token'] || request.headers['X-Reauth-Token'];

    if (!token || typeof token !== 'string') {
      throw new ForbiddenException(
        'Re-authentication token is required for this action.',
      );
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'zito-secure-secret-key',
      });

      if (payload?.purpose !== 'reauth' || payload?.userId !== request.user?.id) {
        throw new Error('Re-authentication token does not match this session.');
      }
    } catch {
      throw new ForbiddenException('Invalid or expired re-authentication token.');
    }

    return true;
  }
}
