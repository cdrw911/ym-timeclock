import { Module } from '@nestjs/common';
import { RetroClockService } from './retro-clock.service';
import {
  RetroClockController,
  RetroClockAdminController,
} from './retro-clock.controller';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AttendanceModule],
  controllers: [RetroClockController, RetroClockAdminController],
  providers: [RetroClockService],
  exports: [RetroClockService],
})
export class RetroClockModule {}
