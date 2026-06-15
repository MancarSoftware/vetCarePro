import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const inventoryStockStatuses = [
  'ALL',
  'AVAILABLE',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'EXPIRING',
] as const;

export type InventoryStockStatus =
  (typeof inventoryStockStatuses)[number];

export class InventoryProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsIn(inventoryStockStatuses)
  stockStatus: InventoryStockStatus = 'ALL';
}
