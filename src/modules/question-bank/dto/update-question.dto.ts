import { PartialType } from '@nestjs/mapped-types';
import { QuestionBankCreateDto } from './create-question.dto';

export class UpdateQuestionBankDto extends PartialType(QuestionBankCreateDto) {}
