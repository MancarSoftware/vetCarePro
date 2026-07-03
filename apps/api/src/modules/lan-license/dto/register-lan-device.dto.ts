import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterLanDeviceDto {
  @IsString()
  @MinLength(12)
  @MaxLength(120)
  deviceId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  deviceName!: string;

  @IsString()
  @IsIn(['lan-client'])
  runtimeMode!: 'lan-client';
}
