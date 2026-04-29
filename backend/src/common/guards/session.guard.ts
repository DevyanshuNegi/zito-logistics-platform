import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { SessionStateService } from '../../modules/auth/session-state.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionStateService: SessionStateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      return true;
    }

    await this.sessionStateService.assertActiveSession({
      sessionId: user.sessionId,
      userId: user.id,
      issuedAt: user.tokenIssuedAt,
    });

    return true;
  }
}
