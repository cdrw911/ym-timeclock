import { Module } from '@nestjs/common';
import { AdvanceNoticeService } from './advance-notice.service';
import { AdvanceNoticeController } from './advance-notice.controller';

@Module({
  controllers: [AdvanceNoticeController],
  providers: [AdvanceNoticeService],
  exports: [AdvanceNoticeService],
})
export class AdvanceNoticeModule {}
