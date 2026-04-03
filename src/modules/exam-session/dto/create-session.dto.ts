import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsDate,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionStatus } from '@prisma/client';

export class CreateExamSessionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsUUID()
  @IsNotEmpty()
  examId: string;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  startTime: Date;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  endTime: Date;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = false;

  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus = SessionStatus.SCHEDULED;

  @IsUUID()
  @IsOptional()
  organizationId?: string;
}
