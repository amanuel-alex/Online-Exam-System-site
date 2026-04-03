import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

/**
 * Guard to enforce Multi-Tenant isolation.
 * If the user is NOT a SYSTEM_ADMIN, they can only access resources matching their organizationId.
 */
@Injectable()
export class MultiTenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params, query, body } = request;

    if (!user) return false;

    // SYSTEM_ADMIN has global access (can override scopes)
    if (user.role === Role.SYSTEM_ADMIN) {
      return true;
    }

    // Capture potential organization ID from various sources
    const orgIdFromRequest = params?.organizationId || query?.organizationId || body?.organizationId;

    if (orgIdFromRequest && orgIdFromRequest !== user.organizationId) {
      throw new ForbiddenException('Access denied. You can only access resources within your own organization.');
    }

    // If no orgId is in the request metadata, we rely on the Service layer to inject the scope from 'user.organizationId'
    return true;
  }
}
