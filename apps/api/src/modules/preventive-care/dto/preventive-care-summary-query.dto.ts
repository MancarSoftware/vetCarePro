import { IsOptional, IsUUID } from 'class-validator';

export class PreventiveCareSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  petId?: string;
}
