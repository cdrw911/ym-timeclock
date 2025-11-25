import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdvanceNoticeDto } from './dto/advance-notice.dto';
import { NoticeType, NoticeSource } from '@prisma/client';
import { startOfDay } from 'date-fns';

@Injectable()
export class AdvanceNoticeService {
  private readonly logger = new Logger(AdvanceNoticeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create advance notice
   */
  async create(userId: string, dto: CreateAdvanceNoticeDto) {
    const { type, expectedDate, expectedMinutes, reason, source = 'WEB' } = dto;

    const dateObj = startOfDay(new Date(expectedDate));

    const notice = await this.prisma.advanceNotice.create({
      data: {
        userId,
        noticeType: type as NoticeType,
        expectedDate: dateObj,
        expectedMinutes,
        reason,
        source: source as NoticeSource,
      },
    });

    this.logger.log(
      `User ${userId} submitted advance notice for ${expectedDate} (${type})`,
    );

    return {
      success: true,
      notice,
      message: 'Advance notice submitted successfully',
    };
  }

  /**
   * Get user's advance notices
   */
  async getUserNotices(userId: string, isUsed?: boolean) {
    const where: any = { userId };
    if (isUsed !== undefined) {
      where.isUsed = isUsed;
    }

    return this.prisma.advanceNotice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get advance notice for a specific date
   */
  async getNoticeForDate(userId: string, date: Date) {
    const dateObj = startOfDay(date);

    return this.prisma.advanceNotice.findFirst({
      where: {
        userId,
        expectedDate: dateObj,
        isUsed: false,
      },
    });
  }

  /**
   * Mark notice as used
   */
  async markAsUsed(noticeId: string, relatedEventId?: string) {
    return this.prisma.advanceNotice.update({
      where: { id: noticeId },
      data: {
        isUsed: true,
        relatedEventId,
      },
    });
  }

  /**
   * Get statistics for a user
   */
  async getUserStats(userId: string, yearMonth: string) {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const notices = await this.prisma.advanceNotice.findMany({
      where: {
        userId,
        expectedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      total: notices.length,
      late: notices.filter((n) => n.noticeType === 'LATE').length,
      leave: notices.filter((n) => n.noticeType === 'LEAVE').length,
      used: notices.filter((n) => n.isUsed).length,
      unused: notices.filter((n) => !n.isUsed).length,
    };
  }
}
