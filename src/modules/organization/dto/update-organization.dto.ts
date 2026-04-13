import { IsString, IsEnum, IsOptional, IsObject, IsBoolean, ValidateNested, Matches, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { OrgType } from '@prisma/client';
import { OrgSettingsDto } from './org-settings.dto';

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  @IsOptional()
  slug?: string;

  @IsEnum(OrgType)
  @IsOptional()
  type?: OrgType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

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
