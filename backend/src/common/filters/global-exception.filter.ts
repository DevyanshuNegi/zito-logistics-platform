import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * PRD §28: Structured Error Responses.
 * Provides clean, actionable error messages for the UI while hiding internal stack traces.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma Unique Constraint Errors (e.g., Email/Phone already exists)
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[]) || [];
        const field = target.length > 0 ? target[0] : 'Record';
        message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
      }
    }

    // PRD §28: Consistent response structure for mobile and web clients
    response.status(status).json({
      success: false,
      statusCode: status,
      message: typeof message === 'string' ? message : (message as any).message || 'Error',
      error: typeof message === 'object' ? (message as any).error : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
      // PRD §28: Stack trace hidden in production; included in dev via environment check if needed
      stack: process.env.NODE_ENV === 'development' && exception instanceof Error ? exception.stack : undefined,
    });
  }
}