import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * PRD §3: Standard JWT Guard to verify session continuity and populate req.user.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}