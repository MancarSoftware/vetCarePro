import { IsIn } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'LOCKED'])
  status!: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
}

