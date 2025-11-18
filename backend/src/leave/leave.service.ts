import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLeaveRequestDto,
  ApproveLeaveDto,
  RejectLeaveDto,
} from './dto/leave.dto';
import { LeaveType, RequestStatus } from '@prisma/client';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Create leave request
   */
  async create(userId: string, dto: CreateLeaveRequestDto) {
    const {
      startDatetime,
      endDatetime,
      type,
      reason,
      hasAdvanceNotice,
      driveFileIds,
    } = dto;

    const start = new Date(startDatetime);
    const end = new Date(endDatetime);

    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check for advance notice
    let advanceNoticeDatetime = null;
    if (hasAdvanceNotice) {
      const notice = await this.prisma.advanceNotice.findFirst({
        where: {
          userId,
          noticeType: 'LEAVE',
          expectedDate: {
            gte: new Date(start.toDateString()),
            lte: new Date(end.toDateString()),
          },
          isUsed: false,
        },
      });

      if (notice) {
        advanceNoticeDatetime = notice.createdAt;
        // Will mark as used when approved
      }
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        userId,
        startDatetime: start,
        endDatetime: end,
        type: type as LeaveType,
        reason,
        hasAdvanceNotice: !!advanceNoticeDatetime,
        advanceNoticeDatetime,
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
      `Leave request created: ${leaveRequest.id} for user ${userId}`,
    );

    return {
      success: true,
      leaveRequest,
      message: 'Leave request submitted successfully',
    };
  }

  /**
   * Get leave requests (with filters)
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
      where.startDatetime = {};
      if (filters.startDate) {
        where.startDatetime.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.startDatetime.lte = filters.endDate;
      }
    }

    return this.prisma.leaveRequest.findMany({
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
   * Get single leave request
   */
  async findOne(id: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: true,
        approver: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    return request;
  }

  /**
   * Approve leave request
   */
  async approve(id: string, approverId: string, dto: ApproveLeaveDto) {
    const request = await this.findOne(id);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Leave request is not pending');
    }

    // Update request status
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId,
        reviewNotes: dto.notes,
      },
      include: {
        user: true,
      },
    });

    this.logger.log(`Leave request ${id} approved by ${approverId}`);

    // Mark advance notice as used if exists
    if (updated.hasAdvanceNotice) {
      await this.prisma.advanceNotice.updateMany({
        where: {
          userId: updated.userId,
          noticeType: 'LEAVE',
          expectedDate: {
            gte: new Date(updated.startDatetime.toDateString()),
            lte: new Date(updated.endDatetime.toDateString()),
          },
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });
    }

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'approve_leave',
        targetType: 'LeaveRequest',
        targetId: id,
        changes: {
          status: 'APPROVED',
          notes: dto.notes,
        },
      },
    });

    // Integrate with Google Calendar
    try {
      const calendarEventId =
        await this.integrationsService.createCalendarEvent({
          title: `${updated.user.name} - Leave (${updated.type})`,
          description: updated.reason,
          startTime: updated.startDatetime,
          endTime: updated.endDatetime,
          attendees: [updated.user.email],
        });

      if (calendarEventId) {
        await this.prisma.leaveRequest.update({
          where: { id },
          data: { calendarEventId },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create calendar event: ${error.message}`);
    }

    // Integrate with Notion
    try {
      const notionPageId = await this.integrationsService.createNotionLeave({
        employeeName: updated.user.name,
        type: updated.type,
        startDate: updated.startDatetime,
        endDate: updated.endDatetime,
        reason: updated.reason,
        status: 'APPROVED',
      });

      if (notionPageId) {
        await this.prisma.leaveRequest.update({
          where: { id },
          data: { notionPageId },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create Notion page: ${error.message}`);
    }

    return {
      success: true,
      leaveRequest: updated,
      message: 'Leave request approved successfully',
    };
  }

  /**
   * Reject leave request
   */
  async reject(id: string, approverId: string, dto: RejectLeaveDto) {
    const request = await this.findOne(id);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Leave request is not pending');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId,
        reviewNotes: dto.reason,
      },
    });

    this.logger.log(`Leave request ${id} rejected by ${approverId}`);

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'reject_leave',
        targetType: 'LeaveRequest',
        targetId: id,
        changes: {
          status: 'REJECTED',
          reason: dto.reason,
        },
      },
    });

    return {
      success: true,
      leaveRequest: updated,
      message: 'Leave request rejected',
    };
  }

  /**
   * Get user's leave statistics
   */
  async getUserStats(userId: string, yearMonth: string) {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        startDatetime: {
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
      withAdvanceNotice: requests.filter((r) => r.hasAdvanceNotice).length,
    };
  }
}
