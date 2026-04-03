import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Role } from '@prisma/client';

// Simple RBAC mapping for demonstration purposes.
// In a full application, permissions might be stored in the DB.
const RolePermissions: Record<Role, string[]> = {
  SYSTEM_ADMIN: [
    'create:user', 'read:user', 'update:user', 'delete:user', 'assign:role', 'organization:user:manage',
    'create:question', 'read:question', 'update:question', 'delete:question',
    'create:exam', 'read:exam', 'update:exam', 'delete:exam', 'start:exam', 'grade:exam'
  ],
  ORG_ADMIN: [
    'create:user', 'read:user', 'update:user', 'assign:role', 'organization:user:manage',
    'create:question', 'read:question', 'update:question', 'delete:question',
    'create:exam', 'read:exam', 'update:exam', 'delete:exam', 'grade:exam'
  ],
  TEACHER: [
    'read:user', 
    'create:question', 'read:question', 'update:question', 'delete:question',
    'create:exam', 'read:exam', 'update:exam', 'start:exam', 'grade:exam'
  ],
  EXAMINER: [
    'read:user', 'read:question', 'read:exam', 'grade:exam'
  ],
  STUDENT: [
    'read:exam', 'start:exam'
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions restricted
    }
    
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      return false;
    }

    const unmappedUserRole = user.role as Role;
    const userPermissions = RolePermissions[unmappedUserRole] || [];

    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }
}
