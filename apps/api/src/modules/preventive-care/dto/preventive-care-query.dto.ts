import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PreventiveCareStatus } from '../../../generated/prisma/enums';

export class PreventiveCareQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsEnum(PreventiveCareStatus)
  status?: PreventiveCareStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
