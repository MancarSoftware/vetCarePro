import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ExpenseCategory } from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FinanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;
}
