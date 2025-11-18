import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import { AdvanceNoticeService } from './advance-notice.service';
import { CreateAdvanceNoticeDto } from './dto/advance-notice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('advance-notice')
@UseGuards(JwtAuthGuard)
export class AdvanceNoticeController {
  constructor(private readonly advanceNoticeService: AdvanceNoticeService) {}

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAdvanceNoticeDto,
  ) {
    return this.advanceNoticeService.create(userId, dto);
  }

  @Get()
  async getMyNotices(
    @CurrentUser('userId') userId: string,
    @Query('isUsed', new ParseBoolPipe({ optional: true })) isUsed?: boolean,
  ) {
    return this.advanceNoticeService.getUserNotices(userId, isUsed);
  }

  @Get('stats')
  async getMyStats(
    @CurrentUser('userId') userId: string,
    @Query('month') month: string,
  ) {
    return this.advanceNoticeService.getUserStats(userId, month);
  }
}
