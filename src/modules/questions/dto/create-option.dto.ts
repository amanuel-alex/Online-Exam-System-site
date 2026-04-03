import {
  IsString,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateOptionDto {
  @IsString()
  @IsNotEmpty({ message: 'Option text must not be empty.' })
  text: string;

  @IsBoolean({ message: 'isCorrect must be a boolean.' })
  isCorrect: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}
