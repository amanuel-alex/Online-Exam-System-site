import {
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GradingSystem {
  PERCENTAGE = 'PERCENTAGE',
  GPA = 'GPA',
  GRADE_SCALE = 'GRADE_SCALE',
}

class GradingConfigDto {
  @IsEnum(GradingSystem)
  @IsOptional()
  system?: GradingSystem = GradingSystem.PERCENTAGE;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultPassMark?: number = 50;
}

class ExamDefaultConfigDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxAttempts?: number = 3;

  @IsNumber()
  @Min(1)
  @IsOptional()
  defaultDurationMinutes?: number = 60;

  @IsBoolean()
  @IsOptional()
  requireProctoring?: boolean = false;
}

export class UpdateOrgConfigDto {
  @ValidateNested()
  @Type(() => GradingConfigDto)
  @IsOptional()
  grading?: GradingConfigDto;

  @ValidateNested()
  @Type(() => ExamDefaultConfigDto)
  @IsOptional()
  exams?: ExamDefaultConfigDto;
}
