import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MaxLength(160)
  deviceName!: string;
}

