import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateOwnerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'La cedula debe tener exactamente 10 digitos numericos',
  })
  nationalId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'El telefono debe tener exactamente 10 digitos numericos',
  })
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
