import {
  IsString,
  IsUUID,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class SaveAttemptAnswerDto {
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  /** For ESSAY types */
  @IsString()
  @IsOptional()
  textAnswer?: string;

  /** For MCQ / TRUE_FALSE types */
  @IsString()
  @IsOptional()
  optionId?: string;

  /** For FILE_UPLOAD types */
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
