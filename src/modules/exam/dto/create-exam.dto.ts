import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  IsDate,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startTime?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endTime?: Date;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxAttempts?: number = 1;

  @IsBoolean()
  @IsOptional()
  randomizeQuestions?: boolean = false;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  passPercentage?: number = 50.0;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean = false;

  @IsString()
  @IsOptional()
  organizationId?: string;
}
