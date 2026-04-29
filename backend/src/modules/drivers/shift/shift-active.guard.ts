import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ShiftService } from './shift.service';

// PRD §44.1: Driver cannot accept trips without an active shift
// Wire this guard onto any driver trip-acceptance endpoint
@Injectable()
export class ShiftActiveGuard implements CanActivate {
  constructor(private readonly shiftService: ShiftService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user || (user.activeRole !== 'DRIVER' && user.role !== 'DRIVER')) return true;
    if (!user.driverId) {
      throw new ForbiddenException('Driver profile not found for this account');
    }

    await this.shiftService.assertActiveShift(user.driverId);
    return true;
  }
}
