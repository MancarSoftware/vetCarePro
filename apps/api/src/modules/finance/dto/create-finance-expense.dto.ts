import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ExpenseCategory } from '../../../generated/prisma/enums';

export class CreateFinanceExpenseDto {
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999)
  amount!: number;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
