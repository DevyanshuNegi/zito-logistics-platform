import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';

// Schema reality:
// AuditLog.userId is REQUIRED (String, not String?) — relation to User
// Solution: only write audit log when a valid authenticated userId is present
// System/anonymous events are NOT logged here — handled by InternalAlert instead

export const AUDIT_KEY = 'audit_action';

export const Audit = (action: string): MethodDecorator =>
  (target, key, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(AUDIT_KEY, action, descriptor.value);
    return descriptor;
  };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const action = this.reflector.get<string>(AUDIT_KEY, handler);

    const shouldAudit = action || this.isAutoAuditPath(req.method, req.path);
    if (!shouldAudit) return next.handle();

    // Only audit authenticated requests — AuditLog.userId is required
    const userId: string | undefined = req.user?.id;
    if (!userId) return next.handle();

    const startTime = Date.now();
    const auditAction = action || this.inferAction(req.method, req.path);

    return next.handle().pipe(
      tap(async (response) => {
        await this.writeLog({
          userId,
          action: auditAction,
          entityType: this.inferEntityType(req.path),
          entityId: response?.id ?? response?.booking?.id ?? req.params?.id ?? userId,
          details: {
            method: req.method,
            path: req.path,
            params: req.params,
            queryKeys: Object.keys(req.query ?? {}),
            bodyKeys: Object.keys(req.body ?? {}),
            durationMs: Date.now() - startTime,
            success: true,
          },
          ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
        });
      }),
      catchError((err) => {
        this.writeLog({
          userId,
          action: auditAction,
          entityType: this.inferEntityType(req.path),
          entityId: req.params?.id ?? userId,
          details: {
            method: req.method,
            path: req.path,
            durationMs: Date.now() - startTime,
            success: false,
            error: err.message,
            statusCode: err.status,
          },
          ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
        }).catch(() => {});
        return throwError(() => err);
      }),
    );
  }

  private async writeLog(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, any>;
    ipAddress?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId:     data.userId,
          action:     data.action,
          entityType: data.entityType,
          entityId:   data.entityId,
          details:    data.details,
          ipAddress:  data.ipAddress ?? null,
        },
      });
    } catch {
      // Audit must never crash the response
    }
  }

  private isAutoAuditPath(method: string, path: string): boolean {
    return [
      { method: 'POST',  path: '/auth/' },
      { method: 'POST',  path: '/bookings' },
      { method: 'PATCH', path: '/bookings/' },
      { method: 'POST',  path: '/payments/' },
      { method: 'PATCH', path: '/admin/' },
      { method: 'POST',  path: '/wallet/' },
    ].some((p) => method === p.method && path.includes(p.path));
  }

  private inferAction(method: string, path: string): string {
    if (path.includes('/auth/login'))    return 'LOGIN';
    if (path.includes('/auth/logout'))   return 'LOGOUT';
    if (path.includes('/bookings') && method === 'POST')  return 'BOOKING_CREATED';
    if (path.includes('/bookings') && method === 'PATCH') return 'BOOKING_STATUS_CHANGED';
    if (path.includes('/payments'))      return 'PAYMENT_INITIATED';
    if (path.includes('/admin'))         return 'ADMIN_OVERRIDE';
    return `${method}_${path.replace(/[/:-]/g, '_').toUpperCase()}`;
  }

  private inferEntityType(path: string): string {
    if (path.includes('/bookings') || path.includes('/trips')) return 'BOOKING';
    if (path.includes('/payments'))  return 'PAYMENT';
    if (path.includes('/drivers'))   return 'DRIVER';
    if (path.includes('/users'))     return 'USER';
    if (path.includes('/fleet') || path.includes('/vehicles')) return 'VEHICLE';
    if (path.includes('/auth'))      return 'AUTH';
    return 'SYSTEM';
  }
}
