import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRetroClockDto,
  ApproveRetroClockDto,
  RejectRetroClockDto,
} from './dto/retro-clock.dto';
import { RetroClockType, RequestStatus, EventType, EventSource } from '@prisma/client';
import { AttendanceService } from '../attendance/attendance.service';
import { parse, startOfDay } from 'date-fns';

@Injectable()
export class RetroClockService {
  private readonly logger = new Logger(RetroClockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Create retro clock request
   */
  async create(userId: string, dto: CreateRetroClockDto) {
    const {
      date,
      time,
      type,
      reason,
      improvementPlan,
      driveFileIds,
    } = dto;

    const dateObj = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    const timeObj = new Date();
    timeObj.setHours(hours, minutes, 0, 0);

    const request = await this.prisma.retroClockRequest.create({
      data: {
        userId,
        date: dateObj,
        time: timeObj,
        type: type as RetroClockType,
        reason,
        improvementPlan,
        driveFileIds: driveFileIds || [],
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            code: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Retro clock request created: ${request.id} for user ${userId}`,
    );

    return {
      success: true,
      request,
      message: 'Retro clock request submitted successfully',
    };
  }

  /**
   * Get retro clock requests (with filters)
   */
  async findAll(filters: {
    userId?: string;
    status?: RequestStatus;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    return this.prisma.retroClockRequest.findMany({
      where,
      include: {
        user: {
          select: {
            code: true,
            name: true,
            email: true,
          },
        },
        approver: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single retro clock request
   */
  async findOne(id: string) {
    const request = await this.prisma.retroClockRequest.findUnique({
      where: { id },
      include: {
        user: true,
        approver: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Retro clock request not found');
    }

    return request;
  }

  /**
   * Approve retro clock request
   */
  async approve(id: string, approverId: string, dto: ApproveRetroClockDto) {
    const request = await this.findOne(id);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Retro clock request is not pending');
    }

    // Map retro clock type to event type
    const eventTypeMap: Record<RetroClockType, EventType> = {
      WORK_ONSITE_START: 'WORK_ONSITE_START',
      WORK_ONSITE_END: 'WORK_ONSITE_END',
      WORK_REMOTE_START: 'WORK_REMOTE_START',
      WORK_REMOTE_END: 'WORK_REMOTE_END',
      BREAK_START: 'BREAK_OFFSITE_START',
      BREAK_END: 'BREAK_OFFSITE_END',
    };

    const eventType = eventTypeMap[request.type];

    // Create attendance event with retro source
    const timestamp = new Date(request.date);
    const [hours, minutes] = request.time.toTimeString().split(':').map(Number);
    timestamp.setHours(hours, minutes, 0, 0);

    const event = await this.prisma.attendanceEvent.create({
      data: {
        userId: request.userId,
        type: eventType,
        timestamp,
        source: 'RETRO_APPROVED' as EventSource,
        relatedRequestId: request.id,
        metadata: {
          approvedBy: approverId,
          reason: request.reason,
          improvementPlan: request.improvementPlan,
        },
      },
    });

    // Update request status
    const updated = await this.prisma.retroClockRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId,
        reviewNotes: dto.notes,
      },
    });

    this.logger.log(`Retro clock request ${id} approved by ${approverId}`);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'approve_retro_clock',
        targetType: 'RetroClockRequest',
        targetId: id,
        changes: {
          status: 'APPROVED',
          notes: dto.notes,
          eventId: event.id,
        },
      },
    });

    // Recalculate day summary
    await this.attendanceService.calculateDaySummary(
      request.userId,
      startOfDay(request.date),
    );

    return {
      success: true,
      request: updated,
      event,
      message: 'Retro clock request approved successfully',
    };
  }

  /**
   * Reject retro clock request
   */
  async reject(id: string, approverId: string, dto: RejectRetroClockDto) {
    const request = await this.findOne(id);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Retro clock request is not pending');
    }

    const updated = await this.prisma.retroClockRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId,
        reviewNotes: dto.reason,
      },
    });

    this.logger.log(`Retro clock request ${id} rejected by ${approverId}`);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'reject_retro_clock',
        targetType: 'RetroClockRequest',
        targetId: id,
        changes: {
          status: 'REJECTED',
          reason: dto.reason,
        },
      },
    });

    return {
      success: true,
      request: updated,
      message: 'Retro clock request rejected',
    };
  }

  /**
   * Get user's retro clock statistics
   */
  async getUserStats(userId: string, yearMonth: string) {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const requests = await this.prisma.retroClockRequest.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      total: requests.length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
    };
  }
}
