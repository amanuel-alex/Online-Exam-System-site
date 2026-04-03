import {
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExamQuestionItemDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  /** Order of the question in the exam. */
  @IsInt()
  @Min(0)
  orderIndex: number;

  /** Overrides the default question's points for this specific exam. */
  @IsNumber()
  @Min(0.1)
  @IsOptional()
  pointsOverride?: number;
}

export class AssignQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ExamQuestionItemDto)
  questions: ExamQuestionItemDto[];
}
