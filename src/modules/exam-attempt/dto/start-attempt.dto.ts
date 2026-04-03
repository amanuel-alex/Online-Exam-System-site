import { IsUUID, IsNotEmpty } from 'class-validator';

export class StartAttemptDto {
  @IsUUID()
  @IsNotEmpty()
  examId: string;
}
