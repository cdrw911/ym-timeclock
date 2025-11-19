import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  ClockInDto,
  ClockOutDto,
  BreakDto,
  GetDaySummaryDto,
  GetMonthSummaryDto,
} from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { parseISO } from 'date-fns';

@Controller('clock')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Clock in
   */
  @Post('in')
  @UseGuards(JwtAuthGuard)
  async clockIn(@CurrentUser('userId') userId: string, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(userId, dto);
  }

  /**
   * Clock out
   */
  @Post('out')
  @UseGuards(JwtAuthGuard)
  async clockOut(@CurrentUser('userId') userId: string, @Body() dto: ClockOutDto) {
    return this.attendanceService.clockOut(userId, dto);
  }

  /**
   * Break start
   */
  @Post('break-start')
  @UseGuards(JwtAuthGuard)
  async breakStart(@CurrentUser('userId') userId: string, @Body() dto: BreakDto) {
    return this.attendanceService.breakStart(userId, dto);
  }

  /**
   * Break end
   */
  @Post('break-end')
  @UseGuards(JwtAuthGuard)
  async breakEnd(@CurrentUser('userId') userId: string, @Body() dto: BreakDto) {
    return this.attendanceService.breakEnd(userId, dto);
  }

  /**
   * Get today's status
   */
  @Get('today')
  @UseGuards(JwtAuthGuard)
  async getTodayStatus(@CurrentUser('userId') userId: string) {
    return this.attendanceService.getTodayStatus(userId);
  }
}

@Controller('me')
export class MeController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Get today's attendance
   */
  @Get('today')
  @UseGuards(JwtAuthGuard)
  async getToday(@CurrentUser('userId') userId: string) {
    return this.attendanceService.getTodayStatus(userId);
  }

  /**
   * Get day summary
   */
  @Get('day-summary')
  @UseGuards(JwtAuthGuard)
  async getDaySummary(
    @CurrentUser('userId') userId: string,
    @Query() query: GetDaySummaryDto,
  ) {
    const date = parseISO(query.date);
    return this.attendanceService.getDaySummary(userId, date);
  }

  /**
   * Get month summary
   */
  @Get('month-summary')
  @UseGuards(JwtAuthGuard)
  async getMonthSummary(
    @CurrentUser('userId') userId: string,
    @Query() query: GetMonthSummaryDto,
  ) {
    return this.attendanceService.getMonthSummary(userId, query.month);
  }
}
