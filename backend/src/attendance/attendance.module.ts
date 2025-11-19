import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController, MeController } from './attendance.controller';
import { WorkHoursCalculator } from './work-hours.calculator';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AttendanceController, MeController],
  providers: [AttendanceService, WorkHoursCalculator],
  exports: [AttendanceService],
})
export class AttendanceModule {}
