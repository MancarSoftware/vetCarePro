import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { MediaCategory } from '../../../generated/prisma/enums';

export class MediaQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @IsOptional()
  @IsEnum(MediaCategory)
  category?: MediaCategory;
}
