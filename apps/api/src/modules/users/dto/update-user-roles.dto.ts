import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
} from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  roleCodes!: string[];
}

