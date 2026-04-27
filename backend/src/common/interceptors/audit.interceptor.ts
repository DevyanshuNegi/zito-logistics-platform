import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, ip, user } = req;

    // Only log mutations, skip GETs, and only log if we have a user
    if (method === 'GET' || !user?.id) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.prisma.auditLog.create({
            data: {
              userId: user.id, // Mandatory user per schema.prisma
              action: `HTTP_${method}_${url.split('?')[0]}`,
              entityType: 'HTTP_REQUEST',
              entityId: '',
              details: { body: this.sanitize(body) },
              ipAddress: ip,
              deviceInfo: req.headers['user-agent'] || '',
            },
          });
        } catch (err) {
          // Fire and forget, don't crash the request
        }
      }),
    );
  }

  private sanitize(body: any): any {
    if (!body) return {};
    const safeBody = { ...body };
    const sensitives = ['password', 'pin', 'token', 'secret'];
    for (const key of Object.keys(safeBody)) {
      if (sensitives.includes(key.toLowerCase())) {
        safeBody[key] = '***';
      }
    }
    return safeBody;
  }
}
