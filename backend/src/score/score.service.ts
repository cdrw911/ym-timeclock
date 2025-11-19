import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ScoreReasonType, ScoreStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ScoreService {
  private readonly logger = new Logger(ScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: SystemConfigService,
  ) {}

  /**
   * Calculate and update monthly score for a user
   */
  async calculateMonthlyScore(userId: string, yearMonth: string) {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get or create score record
    let scoreRecord = await this.prisma.scoreRecord.findUnique({
      where: {
        userId_yearMonth: { userId, yearMonth },
      },
      include: {
        scoreDetails: true,
      },
    });

    if (!scoreRecord) {
      scoreRecord = await this.prisma.scoreRecord.create({
        data: {
          userId,
          yearMonth,
          baseScore: 100,
          status: 'CALCULATING',
        },
        include: {
          scoreDetails: true,
        },
      });
    }

    // Clear existing score details
    await this.prisma.scoreDetail.deleteMany({
      where: { scoreRecordId: scoreRecord.id },
    });

    // Get all day summaries for the month
    const daySummaries = await this.prisma.daySummary.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get retro clock requests for the month
    const retroRequests = await this.prisma.retroClockRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const scoreDetails: any[] = [];

    // Process late deductions
    await this.calculateLateDeductions(
      userId,
      daySummaries,
      scoreDetails,
      scoreRecord.id,
    );

    // Process early leave deductions
    await this.calculateEarlyLeaveDeductions(
      userId,
      daySummaries,
      scoreDetails,
      scoreRecord.id,
    );

    // Process retro clock deductions
    await this.calculateRetroClockDeductions(
      retroRequests,
      scoreDetails,
      scoreRecord.id,
    );

    // Check for perfect attendance bonus
    const hasIssues = daySummaries.some(
      (d) => d.isLate || d.isEarlyLeave || d.isAbsent,
    );
    if (!hasIssues && daySummaries.length > 0) {
      const bonusPoints =
        await this.configService.get<number>('perfect_attendance_bonus');
      scoreDetails.push({
        scoreRecordId: scoreRecord.id,
        reasonType: 'BONUS',
        pointsDelta: new Decimal(bonusPoints),
        notes: 'Perfect attendance bonus',
      });
    }

    // Create score details
    if (scoreDetails.length > 0) {
      await this.prisma.scoreDetail.createMany({
        data: scoreDetails,
      });
    }

    // Calculate total deduction and bonus
    const totalDeduction = scoreDetails
      .filter((d) => d.pointsDelta < 0)
      .reduce((sum, d) => sum + Math.abs(Number(d.pointsDelta)), 0);

    const bonusPoints = scoreDetails
      .filter((d) => d.pointsDelta > 0)
      .reduce((sum, d) => sum + Number(d.pointsDelta), 0);

    const finalScore = 100 - totalDeduction + bonusPoints;

    // Update score record
    const updated = await this.prisma.scoreRecord.update({
      where: { id: scoreRecord.id },
      data: {
        totalDeduction: new Decimal(totalDeduction),
        bonusPoints: new Decimal(bonusPoints),
        finalScore: new Decimal(finalScore),
        status: 'FINAL',
      },
      include: {
        scoreDetails: true,
        user: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(
      `Monthly score calculated for user ${userId}, month ${yearMonth}: ${finalScore}`,
    );

    return updated;
  }

  /**
   * Calculate late deductions
   */
  private async calculateLateDeductions(
    userId: string,
    daySummaries: any[],
    scoreDetails: any[],
    scoreRecordId: string,
  ) {
    const latePointsWithNotice =
      await this.configService.get<Record<string, number>>(
        'late_points_with_notice',
      );
    const latePointsNoNotice =
      await this.configService.get<Record<string, number>>(
        'late_points_no_notice',
      );
    const advanceNoticeLateLimit = await this.configService.get<number>(
      'advance_notice_late_limit',
    );

    const lateDays = daySummaries.filter((d) => d.isLate);
    const lateDaysWithNotice = lateDays.filter((d) => d.hasAdvanceNotice);
    const lateDaysNoNotice = lateDays.filter((d) => !d.hasAdvanceNotice);

    // Calculate deductions for late with notice
    for (let i = 0; i < lateDaysWithNotice.length; i++) {
      const day = lateDaysWithNotice[i];
      const lateMinutes = day.lateMinutes;

      let points = 0;
      if (i < advanceNoticeLateLimit) {
        // First N times with notice - no deduction or partial
        if (lateMinutes > 30) {
          points = latePointsWithNotice['>30'] || -1;
        } else {
          points = latePointsWithNotice['<=30'] || 0;
        }
      } else {
        // After limit, start deducting
        points = -0.5; // Configurable
      }

      if (points < 0) {
        scoreDetails.push({
          scoreRecordId,
          reasonType: 'LATE',
          relatedDate: day.date,
          pointsDelta: new Decimal(points),
          hasAdvanceNotice: true,
          notes: `Late ${lateMinutes} min (with advance notice, occurrence ${i + 1})`,
        });
      }
    }

    // Calculate deductions for late without notice
    for (const day of lateDaysNoNotice) {
      const lateMinutes = day.lateMinutes;

      let points = 0;
      if (lateMinutes <= 30) {
        points = latePointsNoNotice['<=30'] || -1;
      } else if (lateMinutes <= 60) {
        points = latePointsNoNotice['30-60'] || -2;
      } else {
        points = latePointsNoNotice['>60'] || -3;
      }

      scoreDetails.push({
        scoreRecordId,
        reasonType: 'LATE',
        relatedDate: day.date,
        pointsDelta: new Decimal(points),
        hasAdvanceNotice: false,
        notes: `Late ${lateMinutes} min (no advance notice)`,
      });
    }
  }

  /**
   * Calculate early leave deductions
   */
  private async calculateEarlyLeaveDeductions(
    userId: string,
    daySummaries: any[],
    scoreDetails: any[],
    scoreRecordId: string,
  ) {
    const firstTimePoints = await this.configService.get<number>(
      'early_leave_first_time',
    );
    const repeatPoints = await this.configService.get<number>(
      'early_leave_repeat',
    );

    const earlyLeaveDays = daySummaries.filter((d) => d.isEarlyLeave);

    for (let i = 0; i < earlyLeaveDays.length; i++) {
      const day = earlyLeaveDays[i];
      const points = i === 0 ? firstTimePoints : repeatPoints;

      scoreDetails.push({
        scoreRecordId,
        reasonType: 'EARLY_LEAVE',
        relatedDate: day.date,
        pointsDelta: new Decimal(points),
        hasAdvanceNotice: false,
        notes: `Early leave ${day.earlyLeaveMinutes} min (${i === 0 ? '1st time' : 'repeat'})`,
      });
    }
  }

  /**
   * Calculate retro clock deductions
   */
  private async calculateRetroClockDeductions(
    retroRequests: any[],
    scoreDetails: any[],
    scoreRecordId: string,
  ) {
    const retroClockLimit =
      await this.configService.get<Record<string, number>>('retro_clock_limit');

    const count = retroRequests.length;

    if (count >= 1 && count <= 2) {
      // No deduction for first 1-2 times
      const points = retroClockLimit['1-2'] || 0;
      if (points < 0) {
        scoreDetails.push({
          scoreRecordId,
          reasonType: 'RETRO',
          pointsDelta: new Decimal(points),
          notes: `Retro clock ${count} times (1-2 range)`,
        });
      }
    } else if (count >= 3 && count <= 4) {
      const points = retroClockLimit['3-4'] || -1;
      scoreDetails.push({
        scoreRecordId,
        reasonType: 'RETRO',
        pointsDelta: new Decimal(points * (count - 2)), // Deduct for each after 2nd
        notes: `Retro clock ${count} times (3-4 range)`,
      });
    } else if (count >= 5) {
      const points = retroClockLimit['>=5'] || -2;
      scoreDetails.push({
        scoreRecordId,
        reasonType: 'RETRO',
        pointsDelta: new Decimal(points * (count - 2)), // Deduct for each after 2nd
        notes: `Retro clock ${count} times (>=5 range)`,
      });
    }
  }

  /**
   * Get user's monthly score
   */
  async getMonthlyScore(userId: string, yearMonth: string) {
    let score = await this.prisma.scoreRecord.findUnique({
      where: {
        userId_yearMonth: { userId, yearMonth },
      },
      include: {
        scoreDetails: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    // Auto-calculate if not exists or status is CALCULATING
    if (!score || score.status === 'CALCULATING') {
      score = await this.calculateMonthlyScore(userId, yearMonth);
    }

    return score;
  }

  /**
   * Get all scores for a month (admin)
   */
  async getAllScoresForMonth(yearMonth: string) {
    return this.prisma.scoreRecord.findMany({
      where: { yearMonth },
      include: {
        user: {
          select: {
            code: true,
            name: true,
            email: true,
          },
        },
        scoreDetails: true,
      },
      orderBy: { finalScore: 'desc' },
    });
  }

  /**
   * Manually adjust score
   */
  async adjustScore(
    userId: string,
    yearMonth: string,
    adjustmentPoints: number,
    reason: string,
    adjustedBy: string,
  ) {
    const scoreRecord = await this.getMonthlyScore(userId, yearMonth);

    // Add adjustment detail
    await this.prisma.scoreDetail.create({
      data: {
        scoreRecordId: scoreRecord.id,
        reasonType: 'BONUS', // or MISCONDUCT if negative
        pointsDelta: new Decimal(adjustmentPoints),
        notes: `Manual adjustment: ${reason}`,
      },
    });

    // Recalculate final score
    const details = await this.prisma.scoreDetail.findMany({
      where: { scoreRecordId: scoreRecord.id },
    });

    const totalDeduction = details
      .filter((d) => Number(d.pointsDelta) < 0)
      .reduce((sum, d) => sum + Math.abs(Number(d.pointsDelta)), 0);

    const bonusPoints = details
      .filter((d) => Number(d.pointsDelta) > 0)
      .reduce((sum, d) => sum + Number(d.pointsDelta), 0);

    const finalScore = 100 - totalDeduction + bonusPoints;

    const updated = await this.prisma.scoreRecord.update({
      where: { id: scoreRecord.id },
      data: {
        totalDeduction: new Decimal(totalDeduction),
        bonusPoints: new Decimal(bonusPoints),
        finalScore: new Decimal(finalScore),
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: adjustedBy,
        action: 'adjust_score',
        targetType: 'ScoreRecord',
        targetId: scoreRecord.id,
        changes: {
          adjustment: adjustmentPoints,
          reason,
          previousScore: Number(scoreRecord.finalScore),
          newScore: Number(finalScore),
        },
      },
    });

    this.logger.log(
      `Score adjusted for user ${userId}, month ${yearMonth}: ${adjustmentPoints} points`,
    );

    return updated;
  }
}
