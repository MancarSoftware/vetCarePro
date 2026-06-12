import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PetStatus } from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class PetsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  species?: string;

  @IsOptional()
  @IsEnum(PetStatus)
  status?: PetStatus;
}

