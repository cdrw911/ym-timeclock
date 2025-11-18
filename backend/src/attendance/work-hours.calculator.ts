import { Injectable, Logger } from '@nestjs/common';
import { SystemConfigService } from '../system-config/system-config.service';
import { EventType } from '@prisma/client';
import {
  differenceInSeconds,
  parseISO,
  parse,
  format,
  isWithinInterval,
  addHours,
} from 'date-fns';

interface AttendanceEvent {
  type: EventType;
  timestamp: Date;
}

interface TimeSegment {
  start: Date;
  end: Date;
  type: 'onsite' | 'remote';
}

interface BreakSegment {
  start: Date;
  end: Date;
}

@Injectable()
export class WorkHoursCalculator {
  private readonly logger = new Logger(WorkHoursCalculator.name);

  constructor(private readonly configService: SystemConfigService) {}

  /**
   * Calculate daily work hours and status
   */
  async calculate(
    events: AttendanceEvent[],
    date: Date,
    baseSchedule: any,
  ) {
    // Get day of week
    const dayOfWeek = format(date, 'EEEE').toLowerCase();
    const schedule = baseSchedule[dayOfWeek];

    if (!schedule) {
      // Not a work day
      return {
        workOnsiteSeconds: 0,
        workRemoteSeconds: 0,
        totalWorkSeconds: 0,
        scheduledWorkSeconds: 0,
        isLate: false,
        lateMinutes: 0,
        isEarlyLeave: false,
        earlyLeaveMinutes: 0,
        isAbsent: true,
        lunchBreakSeconds: 0,
        breakOffsiteSeconds: 0,
        statusNotes: 'Not a scheduled work day',
      };
    }

    // Get system config
    const lunchStartTime = await this.configService.get<string>('lunch_start_time');
    const lunchEndTime = await this.configService.get<string>('lunch_end_time');
    const lateGraceMinutes = await this.configService.get<number>('late_grace_minutes');

    // Parse scheduled times
    const scheduledStart = this.parseTimeOnDate(date, schedule.start);
    const scheduledEnd = this.parseTimeOnDate(date, schedule.end);
    const lunchStart = this.parseTimeOnDate(date, lunchStartTime);
    const lunchEnd = this.parseTimeOnDate(date, lunchEndTime);

    // Calculate scheduled work seconds
    const scheduledWorkSeconds = differenceInSeconds(scheduledEnd, scheduledStart);

    // Extract work segments (onsite and remote)
    const workSegments = this.extractWorkSegments(events, date);

    // Extract break segments
    const breakSegments = this.extractBreakSegments(events, date);

    // Calculate work seconds by type
    let workOnsiteSeconds = 0;
    let workRemoteSeconds = 0;

    for (const segment of workSegments) {
      let segmentSeconds = differenceInSeconds(segment.end, segment.start);

      // Subtract lunch break if work spans lunch time
      const lunchSeconds = this.calculateLunchOverlap(
        segment.start,
        segment.end,
        lunchStart,
        lunchEnd,
      );
      segmentSeconds -= lunchSeconds;

      // Subtract offsite breaks
      for (const breakSeg of breakSegments) {
        const breakOverlap = this.calculateOverlap(
          segment.start,
          segment.end,
          breakSeg.start,
          breakSeg.end,
        );
        segmentSeconds -= breakOverlap;
      }

      // Add to appropriate type
      if (segment.type === 'onsite') {
        workOnsiteSeconds += Math.max(0, segmentSeconds);
      } else {
        workRemoteSeconds += Math.max(0, segmentSeconds);
      }
    }

    const totalWorkSeconds = workOnsiteSeconds + workRemoteSeconds;

    // Calculate lunch break seconds (default 1.5 hours = 5400 seconds)
    const lunchBreakSeconds = 5400;

    // Calculate total break offsite seconds
    const breakOffsiteSeconds = breakSegments.reduce(
      (sum, seg) => sum + differenceInSeconds(seg.end, seg.start),
      0,
    );

    // Check for late
    const firstWorkEvent = events.find((e) =>
      ['WORK_ONSITE_START', 'WORK_REMOTE_START'].includes(e.type),
    );

    let isLate = false;
    let lateMinutes = 0;

    if (firstWorkEvent) {
      const graceTime = addHours(scheduledStart, 0);
      graceTime.setMinutes(graceTime.getMinutes() + lateGraceMinutes);

      if (firstWorkEvent.timestamp > graceTime) {
        isLate = true;
        lateMinutes = Math.floor(
          differenceInSeconds(firstWorkEvent.timestamp, scheduledStart) / 60,
        );
      }
    }

    // Check for early leave (strict - no grace period)
    const lastWorkEndEvent = events
      .filter((e) => ['WORK_ONSITE_END', 'WORK_REMOTE_END'].includes(e.type))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    let isEarlyLeave = false;
    let earlyLeaveMinutes = 0;

    if (lastWorkEndEvent && lastWorkEndEvent.timestamp < scheduledEnd) {
      isEarlyLeave = true;
      earlyLeaveMinutes = Math.floor(
        differenceInSeconds(scheduledEnd, lastWorkEndEvent.timestamp) / 60,
      );
    }

    // Check for absent (no work events)
    const isAbsent = workSegments.length === 0;

    // Generate status notes
    const statusNotes = this.generateStatusNotes({
      isLate,
      lateMinutes,
      isEarlyLeave,
      earlyLeaveMinutes,
      isAbsent,
      totalWorkSeconds,
      scheduledWorkSeconds,
    });

    return {
      workOnsiteSeconds,
      workRemoteSeconds,
      totalWorkSeconds,
      scheduledWorkSeconds,
      isLate,
      lateMinutes,
      isEarlyLeave,
      earlyLeaveMinutes,
      isAbsent,
      lunchBreakSeconds,
      breakOffsiteSeconds,
      statusNotes,
    };
  }

  /**
   * Extract work segments from events
   */
  private extractWorkSegments(
    events: AttendanceEvent[],
    date: Date,
  ): TimeSegment[] {
    const segments: TimeSegment[] = [];
    let currentStart: Date | null = null;
    let currentType: 'onsite' | 'remote' | null = null;

    for (const event of events) {
      if (event.type === 'WORK_ONSITE_START') {
        currentStart = event.timestamp;
        currentType = 'onsite';
      } else if (event.type === 'WORK_REMOTE_START') {
        currentStart = event.timestamp;
        currentType = 'remote';
      } else if (
        event.type === 'WORK_ONSITE_END' ||
        event.type === 'WORK_REMOTE_END'
      ) {
        if (currentStart && currentType) {
          segments.push({
            start: currentStart,
            end: event.timestamp,
            type: currentType,
          });
          currentStart = null;
          currentType = null;
        }
      }
    }

    // If no end event, use end of day
    if (currentStart && currentType) {
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      segments.push({
        start: currentStart,
        end: endOfDay,
        type: currentType,
      });
    }

    return segments;
  }

  /**
   * Extract break segments from events
   */
  private extractBreakSegments(
    events: AttendanceEvent[],
    date: Date,
  ): BreakSegment[] {
    const segments: BreakSegment[] = [];
    let breakStart: Date | null = null;

    for (const event of events) {
      if (event.type === 'BREAK_OFFSITE_START') {
        breakStart = event.timestamp;
      } else if (event.type === 'BREAK_OFFSITE_END' && breakStart) {
        segments.push({
          start: breakStart,
          end: event.timestamp,
        });
        breakStart = null;
      }
    }

    return segments;
  }

  /**
   * Calculate lunch break overlap with work segment
   */
  private calculateLunchOverlap(
    workStart: Date,
    workEnd: Date,
    lunchStart: Date,
    lunchEnd: Date,
  ): number {
    return this.calculateOverlap(workStart, workEnd, lunchStart, lunchEnd);
  }

  /**
   * Calculate overlap between two time ranges
   */
  private calculateOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
  ): number {
    const overlapStart = start1 > start2 ? start1 : start2;
    const overlapEnd = end1 < end2 ? end1 : end2;

    if (overlapStart >= overlapEnd) {
      return 0;
    }

    return differenceInSeconds(overlapEnd, overlapStart);
  }

  /**
   * Parse time string on a specific date
   */
  private parseTimeOnDate(date: Date, timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Generate human-readable status notes
   */
  private generateStatusNotes(status: {
    isLate: boolean;
    lateMinutes: number;
    isEarlyLeave: boolean;
    earlyLeaveMinutes: number;
    isAbsent: boolean;
    totalWorkSeconds: number;
    scheduledWorkSeconds: number;
  }): string {
    const notes: string[] = [];

    if (status.isAbsent) {
      notes.push('Absent - No clock in record');
    } else {
      if (status.isLate) {
        notes.push(`Late by ${status.lateMinutes} minutes`);
      }
      if (status.isEarlyLeave) {
        notes.push(`Early leave by ${status.earlyLeaveMinutes} minutes`);
      }

      const workHours = (status.totalWorkSeconds / 3600).toFixed(2);
      const scheduledHours = (status.scheduledWorkSeconds / 3600).toFixed(2);
      notes.push(`Worked ${workHours}h / Scheduled ${scheduledHours}h`);
    }

    return notes.join('; ');
  }
}
