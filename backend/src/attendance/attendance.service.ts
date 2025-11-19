import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventType, EventSource } from '@prisma/client';
import { startOfDay, endOfDay, parseISO, format } from 'date-fns';
import { ClockInDto, ClockOutDto, BreakDto } from './dto/attendance.dto';
import { UsersService } from '../users/users.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { WorkHoursCalculator } from './work-hours.calculator';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly configService: SystemConfigService,
    private readonly calculator: WorkHoursCalculator,
  ) {}

  /**
   * Clock in (上班打卡)
   */
  async clockIn(userId: string, dto: ClockInDto) {
    const { type, source = 'WEB', metadata } = dto;

    // Validate user exists and is active
    const user = await this.usersService.findOne(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    const now = new Date();
    const today = startOfDay(now);

    // Check if already clocked in today
    const existingClockIn = await this.prisma.attendanceEvent.findFirst({
      where: {
        userId,
        timestamp: {
          gte: today,
          lt: endOfDay(now),
        },
        type: {
          in: [
            type === 'onsite' ? 'WORK_ONSITE_START' : 'WORK_REMOTE_START',
          ],
        },
      },
    });

    if (existingClockIn) {
      throw new BadRequestException('Already clocked in today');
    }

    // Create attendance event
    const eventType: EventType =
      type === 'onsite' ? 'WORK_ONSITE_START' : 'WORK_REMOTE_START';

    const event = await this.prisma.attendanceEvent.create({
      data: {
        userId,
        type: eventType,
        timestamp: now,
        source: source as EventSource,
        metadata: metadata || {},
      },
    });

    this.logger.log(`User ${user.code} clocked in (${type}) at ${now}`);

    // Calculate daily summary
    await this.calculateDaySummary(userId, today);

    return {
      success: true,
      event,
      message: `Successfully clocked in (${type})`,
      timestamp: now,
    };
  }

  /**
   * Clock out (下班打卡)
   */
  async clockOut(userId: string, dto: ClockOutDto) {
    const { source = 'WEB', metadata } = dto;

    const user = await this.usersService.findOne(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    const now = new Date();
    const today = startOfDay(now);

    // Find today's clock in event
    const clockInEvent = await this.prisma.attendanceEvent.findFirst({
      where: {
        userId,
        timestamp: {
          gte: today,
          lt: endOfDay(now),
        },
        type: {
          in: ['WORK_ONSITE_START', 'WORK_REMOTE_START'],
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!clockInEvent) {
      throw new BadRequestException('No clock in record found today');
    }

    // Determine clock out type based on clock in type
    const eventType: EventType =
      clockInEvent.type === 'WORK_ONSITE_START'
        ? 'WORK_ONSITE_END'
        : 'WORK_REMOTE_END';

    // Check if already clocked out
    const existingClockOut = await this.prisma.attendanceEvent.findFirst({
      where: {
        userId,
        timestamp: {
          gte: clockInEvent.timestamp,
          lt: endOfDay(now),
        },
        type: eventType,
      },
    });

    if (existingClockOut) {
      throw new BadRequestException('Already clocked out today');
    }

    // Create clock out event
    const event = await this.prisma.attendanceEvent.create({
      data: {
        userId,
        type: eventType,
        timestamp: now,
        source: source as EventSource,
        metadata: metadata || {},
      },
    });

    this.logger.log(`User ${user.code} clocked out at ${now}`);

    // Calculate daily summary
    const summary = await this.calculateDaySummary(userId, today);

    return {
      success: true,
      event,
      summary,
      message: 'Successfully clocked out',
      timestamp: now,
    };
  }

  /**
   * Break start (休息開始)
   */
  async breakStart(userId: string, dto: BreakDto) {
    const { source = 'WEB', metadata } = dto;

    const user = await this.usersService.findOne(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    const now = new Date();
    const today = startOfDay(now);

    // Check if currently on break
    const events = await this.prisma.attendanceEvent.findMany({
      where: {
        userId,
        timestamp: { gte: today, lt: endOfDay(now) },
        type: { in: ['BREAK_OFFSITE_START', 'BREAK_OFFSITE_END'] },
      },
      orderBy: { timestamp: 'desc' },
    });

    const lastBreakEvent = events[0];
    if (lastBreakEvent && lastBreakEvent.type === 'BREAK_OFFSITE_START') {
      throw new BadRequestException('Already on break');
    }

    const event = await this.prisma.attendanceEvent.create({
      data: {
        userId,
        type: 'BREAK_OFFSITE_START',
        timestamp: now,
        source: source as EventSource,
        metadata: metadata || {},
      },
    });

    this.logger.log(`User ${user.code} started break at ${now}`);

    return {
      success: true,
      event,
      message: 'Break started',
      timestamp: now,
    };
  }

  /**
   * Break end (休息結束)
   */
  async breakEnd(userId: string, dto: BreakDto) {
    const { source = 'WEB', metadata } = dto;

    const user = await this.usersService.findOne(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    const now = new Date();
    const today = startOfDay(now);

    // Find the latest break start
    const breakStart = await this.prisma.attendanceEvent.findFirst({
      where: {
        userId,
        timestamp: { gte: today, lt: endOfDay(now) },
        type: 'BREAK_OFFSITE_START',
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!breakStart) {
      throw new BadRequestException('No active break found');
    }

    // Check if already ended
    const breakEnd = await this.prisma.attendanceEvent.findFirst({
      where: {
        userId,
        timestamp: { gte: breakStart.timestamp, lt: endOfDay(now) },
        type: 'BREAK_OFFSITE_END',
      },
    });

    if (breakEnd) {
      throw new BadRequestException('Break already ended');
    }

    const event = await this.prisma.attendanceEvent.create({
      data: {
        userId,
        type: 'BREAK_OFFSITE_END',
        timestamp: now,
        source: source as EventSource,
        metadata: metadata || {},
      },
    });

    this.logger.log(`User ${user.code} ended break at ${now}`);

    // Recalculate daily summary
    await this.calculateDaySummary(userId, today);

    return {
      success: true,
      event,
      message: 'Break ended',
      timestamp: now,
    };
  }

  /**
   * Get today's status for a user
   */
  async getTodayStatus(userId: string) {
    const today = startOfDay(new Date());
    const now = new Date();

    const events = await this.prisma.attendanceEvent.findMany({
      where: {
        userId,
        timestamp: { gte: today, lt: endOfDay(now) },
      },
      orderBy: { timestamp: 'asc' },
    });

    const summary = await this.prisma.daySummary.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    const schedule = await this.usersService.getCurrentSchedule(userId);

    return {
      date: today,
      events,
      summary,
      schedule,
      currentStatus: this.getCurrentStatus(events),
    };
  }

  /**
   * Calculate and save daily summary
   */
  async calculateDaySummary(userId: string, date: Date) {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Get all events for the day
    const events = await this.prisma.attendanceEvent.findMany({
      where: {
        userId,
        timestamp: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) {
      return null;
    }

    // Get user's schedule for this date
    const schedule = await this.usersService.getCurrentSchedule(userId);
    if (!schedule) {
      this.logger.warn(`No schedule found for user ${userId}`);
      return null;
    }

    // Calculate work hours and status
    const calculation = await this.calculator.calculate(
      events,
      date,
      schedule.baseSchedule,
    );

    // Check for advance notice
    const advanceNotice = await this.prisma.advanceNotice.findFirst({
      where: {
        userId,
        expectedDate: dayStart,
        isUsed: false,
      },
    });

    // Create or update day summary
    const summary = await this.prisma.daySummary.upsert({
      where: {
        userId_date: { userId, date: dayStart },
      },
      create: {
        userId,
        date: dayStart,
        ...calculation,
        hasAdvanceNotice: !!advanceNotice,
      },
      update: {
        ...calculation,
        hasAdvanceNotice: !!advanceNotice,
      },
    });

    // Mark advance notice as used
    if (advanceNotice) {
      await this.prisma.advanceNotice.update({
        where: { id: advanceNotice.id },
        data: { isUsed: true },
      });
    }

    this.logger.log(`Updated day summary for ${userId} on ${format(date, 'yyyy-MM-dd')}`);

    return summary;
  }

  /**
   * Determine current status from events
   */
  private getCurrentStatus(events: any[]): string {
    if (events.length === 0) {
      return 'not_started';
    }

    const lastEvent = events[events.length - 1];

    switch (lastEvent.type) {
      case 'WORK_ONSITE_START':
        return 'working_onsite';
      case 'WORK_REMOTE_START':
        return 'working_remote';
      case 'BREAK_OFFSITE_START':
        return 'on_break';
      case 'BREAK_OFFSITE_END':
        const workEvent = events.find((e) =>
          ['WORK_ONSITE_START', 'WORK_REMOTE_START'].includes(e.type),
        );
        return workEvent?.type === 'WORK_ONSITE_START'
          ? 'working_onsite'
          : 'working_remote';
      case 'WORK_ONSITE_END':
      case 'WORK_REMOTE_END':
        return 'finished';
      default:
        return 'unknown';
    }
  }

  /**
   * Get day summary for a specific date
   */
  async getDaySummary(userId: string, date: Date) {
    const dayStart = startOfDay(date);

    return this.prisma.daySummary.findUnique({
      where: {
        userId_date: { userId, date: dayStart },
      },
    });
  }

  /**
   * Get month summary
   */
  async getMonthSummary(userId: string, yearMonth: string) {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const summaries = await this.prisma.daySummary.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    const stats = {
      totalDays: summaries.length,
      totalWorkSeconds: summaries.reduce((sum, s) => sum + s.totalWorkSeconds, 0),
      totalOnsiteSeconds: summaries.reduce((sum, s) => sum + s.workOnsiteSeconds, 0),
      totalRemoteSeconds: summaries.reduce((sum, s) => sum + s.workRemoteSeconds, 0),
      lateDays: summaries.filter((s) => s.isLate).length,
      earlyLeaveDays: summaries.filter((s) => s.isEarlyLeave).length,
      absentDays: summaries.filter((s) => s.isAbsent).length,
      averageWorkHours: 0,
    };

    stats.averageWorkHours =
      stats.totalDays > 0 ? stats.totalWorkSeconds / stats.totalDays / 3600 : 0;

    return {
      yearMonth,
      summaries,
      stats,
    };
  }
}
