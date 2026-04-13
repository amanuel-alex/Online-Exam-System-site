import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class AssignRoleDto {
  @IsEnum(Role)
  role: Role;
}
