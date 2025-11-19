import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsDateString,
} from 'class-validator';

export enum LeaveTypeEnum {
  SICK = 'SICK',
  MENSTRUAL = 'MENSTRUAL',
  PERSONAL = 'PERSONAL',
  OTHER = 'OTHER',
}

export class CreateLeaveRequestDto {
  @IsDateString()
  startDatetime: string;

  @IsDateString()
  endDatetime: string;

  @IsEnum(LeaveTypeEnum)
  type: LeaveTypeEnum;

  @IsString()
  reason: string;

  @IsOptional()
  @IsBoolean()
  hasAdvanceNotice?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  driveFileIds?: string[];
}

export class ApproveLeaveDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectLeaveDto {
  @IsString()
  reason: string;
}
