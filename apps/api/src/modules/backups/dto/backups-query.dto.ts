import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { BackupStatus } from '../../../generated/prisma/enums';

export class BackupsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BackupStatus)
  status?: BackupStatus;
}
