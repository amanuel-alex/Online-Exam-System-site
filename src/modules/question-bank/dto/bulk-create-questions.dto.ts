import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionBankCreateDto } from './create-question.dto';

export class BulkCreateQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => QuestionBankCreateDto)
  questions: QuestionBankCreateDto[];
}
