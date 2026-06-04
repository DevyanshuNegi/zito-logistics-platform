import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const canActivate = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (
      user?.status &&
      user.status !== AccountStatus.ACTIVE &&
      !this.isVerificationRoute(request)
    ) {
      throw new ForbiddenException({
        message: 'Complete verification before accessing this module.',
        data: {
          status: user.status,
          redirectTo: '/complete-verification',
        },
      });
    }

    return canActivate;
  }

  private isVerificationRoute(request: any) {
    const path = String(request.path ?? request.originalUrl ?? '').replace(/^\/api\/v\d+/i, '');
    const method = String(request.method ?? '').toUpperCase();

    if (path === '/users/me' && method === 'GET') {
      return true;
    }

    return (
      path === '/users/me/verification' ||
      path === '/users/me/kyc' ||
      path === '/users/me/kyc/submit' ||
      path.startsWith('/users/me/kyc/')
    );
  }
}
