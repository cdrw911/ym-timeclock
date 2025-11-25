import { IsEnum, IsOptional, IsObject, IsString } from 'class-validator';
import { EventSource } from '@prisma/client';

export enum ClockType {
  ONSITE = 'onsite',
  REMOTE = 'remote',
}

export class ClockInDto {
  @IsEnum(ClockType)
  type: ClockType;

  @IsOptional()
  @IsEnum(['WEB', 'DISCORD', 'ADMIN'])
  source?: EventSource;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ClockOutDto {
  @IsOptional()
  @IsEnum(['WEB', 'DISCORD', 'ADMIN'])
  source?: EventSource;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BreakDto {
  @IsOptional()
  @IsEnum(['WEB', 'DISCORD', 'ADMIN'])
  source?: EventSource;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class GetDaySummaryDto {
  @IsString()
  date: string; // YYYY-MM-DD
}

export class GetMonthSummaryDto {
  @IsString()
  month: string; // YYYY-MM
}
