import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentItemType } from '../../../generated/prisma/enums';

export class PaymentItemDto {
  @IsEnum(PaymentItemType)
  type!: PaymentItemType;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999)
  quantity!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999)
  unitPrice!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999)
  discount?: number;
}
