import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * PRD §42: Role-Based Access Control Metadata.
 * Key used to store and retrieve required roles from route handlers.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which UserRoles are permitted to access a specific endpoint.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);