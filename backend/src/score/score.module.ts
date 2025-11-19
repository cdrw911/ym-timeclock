import { Module } from '@nestjs/common';
import { ScoreService } from './score.service';
import { ScoreController, ScoreAdminController } from './score.controller';

@Module({
  controllers: [ScoreController, ScoreAdminController],
  providers: [ScoreService],
  exports: [ScoreService],
})
export class ScoreModule {}
