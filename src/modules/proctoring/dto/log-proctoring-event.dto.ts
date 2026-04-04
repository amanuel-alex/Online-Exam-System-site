import { IsString, IsEnum, IsOptional, IsObject, IsUUID } from 'class-validator';
import { ProctoringEventType } from '@prisma/client';

export class LogProctoringEventDto {
  @IsUUID()
  attemptId: string;

  @IsEnum(ProctoringEventType)
  eventType: ProctoringEventType;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
