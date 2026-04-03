import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { OrgType } from '@prisma/client';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(OrgType)
  @IsOptional()
  type?: OrgType;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
