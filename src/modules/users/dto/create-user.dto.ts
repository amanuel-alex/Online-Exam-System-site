import { IsString, IsEmail, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  passwordHash: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
