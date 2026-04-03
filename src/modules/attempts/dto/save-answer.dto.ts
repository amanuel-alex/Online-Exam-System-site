import {
  IsString,
  IsUUID,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class SaveAnswerDto {
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  /** Used for ESSAY type questions. */
  @IsString()
  @IsOptional()
  textAnswer?: string;

  /** Used for MCQ / TRUE_FALSE type questions. */
  @IsString()
  @IsOptional()
  optionId?: string;

  /** Used if the answer is a file upload. */
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
