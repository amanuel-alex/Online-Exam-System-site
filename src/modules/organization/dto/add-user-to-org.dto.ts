import { IsString, IsNotEmpty } from 'class-validator';

export class AddUserToOrgDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
