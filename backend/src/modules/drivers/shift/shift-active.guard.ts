import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class ShiftActiveGuard implements CanActivate {
  constructor(private readonly shiftService: ShiftService) {}

  /**
   * PRD §44.1: Mandatory check — drivers must have an active shift before
   * performing any booking or trip action.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.role === UserRole.DRIVER) {
      const isActive = await this.shiftService.isShiftActive(user.id);
      if (!isActive) {
        throw new ForbiddenException(
          'Mandatory shift required: Drivers must start a shift before performing this action (PRD §44.1).',
        );
      }
    }

    return true;
  }
}