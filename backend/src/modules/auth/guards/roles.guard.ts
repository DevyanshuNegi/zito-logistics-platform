import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // No specific roles specified, allow access (protected only by JwtAuthGuard)
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // §4.1 RBAC Enforcement Rules
    if (!user || (!user.role && !user.acting_as)) {
      throw new ForbiddenException('SCOPE_VIOLATION: User role required');
    }

    // Apply View As logic if super admin impersonating
    const activeRole = user.acting_as || user.role;

    // Super Admin has no scope filters — full platform visibility
    if (activeRole === 'super_admin') {
      return true;
    }

    const hasRole = requiredRoles.some((role) => activeRole === role);
    if (!hasRole) {
      throw new ForbiddenException('SCOPE_VIOLATION: Insufficient permissions');
    }

    return true;
  }
}