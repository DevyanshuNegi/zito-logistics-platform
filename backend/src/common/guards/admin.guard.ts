import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
