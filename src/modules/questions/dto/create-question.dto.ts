import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  IsNotEmpty,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '@prisma/client';
import { CreateOptionDto } from './create-option.dto';

export class CreateQuestionDto {
  @IsEnum(QuestionType, { message: `type must be one of: ${Object.values(QuestionType).join(', ')}` })
  type: QuestionType;

  @IsString()
  @IsNotEmpty({ message: 'Question text must not be empty.' })
  text: string;

  @IsNumber()
  @Min(0.1, { message: 'Points must be at least 0.1.' })
  @IsOptional()
  points?: number;

  /**
   * Difficulty on a scale of 1 (easiest) to 5 (hardest).
   */
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  difficulty?: number;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsArray()
  @IsString({ each: true, message: 'Each tag must be a string.' })
  @IsOptional()
  tags?: string[];

  /**
   * Required for MCQ and TRUE_FALSE question types.
   * MCQ needs ≥ 2 options; TRUE_FALSE must have exactly 2.
   * At least one option must have isCorrect = true.
   */
  @ValidateIf(o => o.type === QuestionType.MCQ || o.type === QuestionType.TRUE_FALSE)
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2, { message: 'MCQ and True/False questions require at least 2 options.' })
  @Type(() => CreateOptionDto)
  @IsOptional()
  options?: CreateOptionDto[];

  /**
   * organizationId — only used by SYSTEM_ADMIN when creating questions
   * on behalf of an organization. Regular users are auto-scoped to their org.
   */
  @IsString()
  @IsOptional()
  organizationId?: string;
}
