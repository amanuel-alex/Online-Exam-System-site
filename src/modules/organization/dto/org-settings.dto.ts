import { IsEnum, IsNumber, IsBoolean, IsOptional, IsArray, Min, Max } from 'class-validator';
import { OrgType } from '@prisma/client';

export enum GradingSystem {
  PERCENTAGE = 'PERCENTAGE',
  LETTER_GRADE = 'LETTER_GRADE',
  GPA = 'GPA',
  CUSTOM = 'CUSTOM',
}

export class OrgSettingsDto {
  /**
   * Grading system used by this organization (e.g. percentage, letter grade, GPA, custom).
   */
  @IsEnum(GradingSystem)
  @IsOptional()
  gradingSystem?: GradingSystem;

  /**
   * Default passing score percentage (0–100). Overridable per exam.
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultPassScore?: number;

  /**
   * Exam type(s) supported by this organization.
   */
  @IsEnum(OrgType)
  @IsOptional()
  examType?: OrgType;

  /**
   * Whether online proctoring is enabled globally for this org.
   */
  @IsBoolean()
  @IsOptional()
  proctoringEnabled?: boolean;

  /**
   * Whether randomized questions are enabled globally by default.
   */
  @IsBoolean()
  @IsOptional()
  randomizeByDefault?: boolean;

  /**
   * Default exam duration limit in minutes across all exams.
   */
  @IsNumber()
  @Min(1)
  @IsOptional()
  defaultDurationMinutes?: number;

  /**
   * Maximum number of attempts allowed per exam by default.
   */
  @IsNumber()
  @Min(1)
  @IsOptional()
  defaultMaxAttempts?: number;
}
