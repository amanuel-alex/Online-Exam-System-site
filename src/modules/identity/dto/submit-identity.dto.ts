import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IdType } from '@prisma/client';

export class SubmitIdentityDto {
  @IsEnum(IdType)
  idType: IdType;

  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @IsString()
  @IsOptional()
  documentUrl?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;
}
