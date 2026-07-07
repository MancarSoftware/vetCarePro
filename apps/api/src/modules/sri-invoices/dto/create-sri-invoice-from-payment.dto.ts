import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateSriInvoiceFromPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(13)
  @Matches(/^\d{10}$|^\d{13}$/)
  customerDocument?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  customerEmail?: string;
}
