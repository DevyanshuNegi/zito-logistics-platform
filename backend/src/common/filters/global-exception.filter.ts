import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

// PRD §22 — Clear error messages for all failures
// Standardised error envelope across all endpoints:
// { success: false, statusCode, error, message, details?, timestamp, path }

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let error = 'Internal Server Error';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as any;
        message = resObj.message ?? message;
        error = resObj.error ?? exception.name;
        details = resObj.details;
      }
      error = this.getErrorLabel(status);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Map Prisma errors to human-readable responses
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = this.buildUniqueViolationMessage(exception);
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'The requested record does not exist';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Related record not found — check your foreign key references';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          error = 'Database Error';
          message = 'A database error occurred';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Validation Error';
      message = 'Invalid data provided to database';
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    const body = {
      success: false,
      statusCode: status,
      error,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && { details }),
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private getErrorLabel(status: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return map[status] ?? 'Error';
  }

  private buildUniqueViolationMessage(err: Prisma.PrismaClientKnownRequestError): string {
    const fields = (err.meta?.target as string[]) ?? [];
    if (fields.includes('email')) return 'An account with this email already exists';
    if (fields.includes('phone')) return 'An account with this phone number already exists';
    if (fields.includes('plate_number')) return 'A vehicle with this plate number already exists';
    if (fields.includes('license_number')) return 'A driver with this license number already exists';
    if (fields.includes('key')) return 'Duplicate idempotency key — request already processed';
    return `A record with this ${fields.join(', ')} already exists`;
  }
}