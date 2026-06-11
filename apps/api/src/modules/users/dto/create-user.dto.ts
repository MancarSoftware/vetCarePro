import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/[a-z]/)
  @Matches(/[A-Z]/)
  @Matches(/[0-9]/)
  password!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  roleCodes!: string[];
}

