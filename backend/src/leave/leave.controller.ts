import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import {
  CreateLeaveRequestDto,
  ApproveLeaveDto,
  RejectLeaveDto,
} from './dto/leave.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestStatus } from '@prisma/client';

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  /**
   * Create leave request (user)
   */
  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveService.create(userId, dto);
  }

  /**
   * Get my leave requests
   */
  @Get('my-requests')
  async getMyRequests(
    @CurrentUser('userId') userId: string,
    @Query('status') status?: RequestStatus,
  ) {
    return this.leaveService.findAll({ userId, status });
  }

  /**
   * Get my leave stats
   */
  @Get('my-stats')
  async getMyStats(
    @CurrentUser('userId') userId: string,
    @Query('month') month: string,
  ) {
    return this.leaveService.getUserStats(userId, month);
  }
}

@Controller('admin/leave-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SYSTEM_ADMIN')
export class LeaveAdminController {
  constructor(private readonly leaveService: LeaveService) {}

  /**
   * Get all leave requests (admin)
   */
  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('status') status?: RequestStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.leaveService.findAll({
      userId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * Get single leave request
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.leaveService.findOne(id);
  }

  /**
   * Approve leave request
   */
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser('userId') approverId: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leaveService.approve(id, approverId, dto);
  }

  /**
   * Reject leave request
   */
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser('userId') approverId: string,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveService.reject(id, approverId, dto);
  }
}
