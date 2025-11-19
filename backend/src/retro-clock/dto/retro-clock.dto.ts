import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  Matches,
} from 'class-validator';

export enum RetroClockTypeEnum {
  WORK_ONSITE_START = 'WORK_ONSITE_START',
  WORK_ONSITE_END = 'WORK_ONSITE_END',
  WORK_REMOTE_START = 'WORK_REMOTE_START',
  WORK_REMOTE_END = 'WORK_REMOTE_END',
  BREAK_START = 'BREAK_START',
  BREAK_END = 'BREAK_END',
}

export class CreateRetroClockDto {
  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:mm format',
  })
  time: string; // HH:mm

  @IsEnum(RetroClockTypeEnum)
  type: RetroClockTypeEnum;

  @IsString()
  reason: string;

  @IsString()
  improvementPlan: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  driveFileIds?: string[];
}

export class ApproveRetroClockDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectRetroClockDto {
  @IsString()
  reason: string;
}
