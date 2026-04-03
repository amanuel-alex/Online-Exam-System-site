import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionDto } from './create-question.dto';

/**
 * All fields are optional for updates.
 * Options, if provided, will fully replace the existing set.
 */
export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}
