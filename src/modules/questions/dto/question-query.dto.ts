import {
  IsOptional,
  IsEnum,
  IsInt,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { QuestionType } from '@prisma/client';

export class QuestionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Full-text search across question text, subject, and topic */
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by question type */
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  /** Filter by exact difficulty level (1–5) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  /** Filter by subject (case-insensitive partial match) */
  @IsOptional()
  @IsString()
  subject?: string;

  /** Filter by topic (case-insensitive partial match) */
  @IsOptional()
  @IsString()
  topic?: string;

  /** Filter by a single tag (exact match) */
  @IsOptional()
  @IsString()
  tag?: string;

  /** Include archived questions — defaults to false (active only) */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean = false;

  /**
   * SYSTEM_ADMIN only: scope results to a specific organization's bank.
   * Other roles are automatically scoped to their own organization.
   */
  @IsOptional()
  @IsString()
  organizationId?: string;
}
