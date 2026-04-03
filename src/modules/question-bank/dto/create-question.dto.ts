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
import { QuestionType, QuestionDifficulty } from '@prisma/client';

export class CreateOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsInt()
  @IsOptional()
  orderIndex?: number;
}

import { IsBoolean } from 'class-validator';

export class QuestionBankCreateDto {
  @IsEnum(QuestionType)
  type: QuestionType;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number = 1;

  @IsEnum(QuestionDifficulty)
  @IsOptional()
  difficulty?: QuestionDifficulty = QuestionDifficulty.MEDIUM;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  duration?: number; // In seconds

  @IsString()
  @IsOptional()
  explanation?: string;

  @ValidateIf(o => o.type === QuestionType.MCQ || o.type === QuestionType.TRUE_FALSE)
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @Type(() => CreateOptionDto)
  @IsOptional()
  options?: CreateOptionDto[];

  @IsString()
  @IsOptional()
  organizationId?: string;
}
