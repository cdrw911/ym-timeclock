import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ScoreService } from './score.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('score')
@UseGuards(JwtAuthGuard)
export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  /**
   * Get my monthly score
   */
  @Get('my-score')
  async getMyScore(
    @CurrentUser('userId') userId: string,
    @Query('month') month: string,
  ) {
    return this.scoreService.getMonthlyScore(userId, month);
  }
}

@Controller('admin/scores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SYSTEM_ADMIN')
export class ScoreAdminController {
  constructor(private readonly scoreService: ScoreService) {}

  /**
   * Get all scores for a month
   */
  @Get()
  async getAllScores(@Query('month') month: string) {
    return this.scoreService.getAllScoresForMonth(month);
  }

  /**
   * Get specific user's score
   */
  @Get('user/:userId')
  async getUserScore(
    @Param('userId') userId: string,
    @Query('month') month: string,
  ) {
    return this.scoreService.getMonthlyScore(userId, month);
  }

  /**
   * Recalculate user's monthly score
   */
  @Post('recalculate')
  async recalculate(
    @Query('userId') userId: string,
    @Query('month') month: string,
  ) {
    return this.scoreService.calculateMonthlyScore(userId, month);
  }

  /**
   * Manually adjust score
   */
  @Post('adjust')
  async adjustScore(
    @CurrentUser('userId') adjustedBy: string,
    @Body()
    body: {
      userId: string;
      month: string;
      points: number;
      reason: string;
    },
  ) {
    return this.scoreService.adjustScore(
      body.userId,
      body.month,
      body.points,
      body.reason,
      adjustedBy,
    );
  }
}
