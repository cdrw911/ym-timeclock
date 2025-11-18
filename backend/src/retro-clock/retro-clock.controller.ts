import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RetroClockService } from './retro-clock.service';
import {
  CreateRetroClockDto,
  ApproveRetroClockDto,
  RejectRetroClockDto,
} from './dto/retro-clock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestStatus } from '@prisma/client';

@Controller('retro-clock')
@UseGuards(JwtAuthGuard)
export class RetroClockController {
  constructor(private readonly retroClockService: RetroClockService) {}

  /**
   * Create retro clock request (user)
   */
  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateRetroClockDto,
  ) {
    return this.retroClockService.create(userId, dto);
  }

  /**
   * Get my retro clock requests
   */
  @Get('my-requests')
  async getMyRequests(
    @CurrentUser('userId') userId: string,
    @Query('status') status?: RequestStatus,
  ) {
    return this.retroClockService.findAll({ userId, status });
  }

  /**
   * Get my retro clock stats
   */
  @Get('my-stats')
  async getMyStats(
    @CurrentUser('userId') userId: string,
    @Query('month') month: string,
  ) {
    return this.retroClockService.getUserStats(userId, month);
  }
}

@Controller('admin/retro-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SYSTEM_ADMIN')
export class RetroClockAdminController {
  constructor(private readonly retroClockService: RetroClockService) {}

  /**
   * Get all retro clock requests (admin)
   */
  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('status') status?: RequestStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.retroClockService.findAll({
      userId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * Get single retro clock request
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.retroClockService.findOne(id);
  }

  /**
   * Approve retro clock request
   */
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser('userId') approverId: string,
    @Body() dto: ApproveRetroClockDto,
  ) {
    return this.retroClockService.approve(id, approverId, dto);
  }

  /**
   * Reject retro clock request
   */
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser('userId') approverId: string,
    @Body() dto: RejectRetroClockDto,
  ) {
    return this.retroClockService.reject(id, approverId, dto);
  }
}
