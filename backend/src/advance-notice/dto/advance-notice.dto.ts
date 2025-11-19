import {
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';

export enum AdvanceNoticeType {
  LATE = 'LATE',
  LEAVE = 'LEAVE',
}

export class CreateAdvanceNoticeDto {
  @IsEnum(AdvanceNoticeType)
  type: AdvanceNoticeType;

  @IsDateString()
  expectedDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedMinutes?: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsEnum(['WEB', 'DISCORD', 'TEAMS'])
  source?: string;
}
