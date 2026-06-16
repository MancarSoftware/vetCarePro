import { IsDateString, IsIn, IsOptional } from 'class-validator';

export const reportSections = [
  'all',
  'financial',
  'appointments',
  'clinical',
  'inventory',
] as const;

export type ReportSection = (typeof reportSections)[number];

export class ReportsQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(reportSections)
  section?: ReportSection;
}
