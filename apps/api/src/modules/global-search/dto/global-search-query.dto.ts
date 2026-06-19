import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class GlobalSearchQueryDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MaxLength(120)
  q = '';

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(6)
  @Max(40)
  limit = 24;
}
