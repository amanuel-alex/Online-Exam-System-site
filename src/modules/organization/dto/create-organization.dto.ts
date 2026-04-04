import { IsString, IsEnum, IsOptional, IsObject, ValidateNested, Matches, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { OrgType } from '@prisma/client';
import { OrgSettingsDto } from './org-settings.dto';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  slug: string;

  @IsEnum(OrgType)
  @IsOptional()
  type?: OrgType;

  @ValidateNested()
  @Type(() => OrgSettingsDto)
  @IsOptional()
  settings?: OrgSettingsDto;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  region?: string;
}
