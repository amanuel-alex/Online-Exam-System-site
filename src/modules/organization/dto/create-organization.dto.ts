import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { OrgType } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsEnum(OrgType)
  @IsOptional()
  type?: OrgType;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
