import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class InitializeSystemDto {
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
  @Matches(/[a-z]/, { message: 'La contraseña requiere una minúscula' })
  @Matches(/[A-Z]/, { message: 'La contraseña requiere una mayúscula' })
  @Matches(/[0-9]/, { message: 'La contraseña requiere un número' })
  password!: string;

  @IsString()
  @MaxLength(160)
  deviceName!: string;
}

