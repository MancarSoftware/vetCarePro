import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { MedicalRecordType } from '../../../generated/prisma/enums';

export class MedicalRecordsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsEnum(MedicalRecordType)
  type?: MedicalRecordType;
}
