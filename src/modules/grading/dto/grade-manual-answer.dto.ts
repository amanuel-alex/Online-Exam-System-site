import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class GradeManualAnswerDto {
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsString()
  @IsOptional()
  evalComment?: string;
}
