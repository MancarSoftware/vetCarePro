import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InitialPaymentDto } from './initial-payment.dto';
import { PaymentItemDto } from './payment-item.dto';

export class CreatePaymentDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  walkInCustomerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{1,10}$/)
  walkInCustomerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^\d{1,10}$/)
  walkInCustomerDocument?: string;

  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items!: PaymentItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPaymentDto)
  initialPayment?: InitialPaymentDto;
}
