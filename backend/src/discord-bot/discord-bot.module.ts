import { Module } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { AdvanceNoticeModule } from '../advance-notice/advance-notice.module';

@Module({
  imports: [AttendanceModule, AdvanceNoticeModule],
  providers: [DiscordBotService],
  exports: [DiscordBotService],
})
export class DiscordBotModule {}
