import { IsArray, IsUUID, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class AssignUserToSessionDto {
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @IsNotEmpty()
  userIds: string[];
}
