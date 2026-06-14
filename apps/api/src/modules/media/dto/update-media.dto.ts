import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MediaCategory } from '../../../generated/prisma/enums';

export class UpdateMediaDto {
  @IsOptional()
  @IsEnum(MediaCategory)
  category?: MediaCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;
}
