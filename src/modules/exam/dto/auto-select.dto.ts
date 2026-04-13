import {
  IsInt,
  Min,
  Max,
  IsEnum,
  IsString,
  IsOptional,
} from 'class-validator';
import { QuestionDifficulty } from '@prisma/client';

export class AutoSelectQuestionsDto {
  /** Number of questions to pick randomly. */
  @IsInt()
  @Min(1)
  @Max(100)
  count: number;

  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  tag?: string;
}
