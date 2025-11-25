import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { RetroClockModule } from './retro-clock/retro-clock.module';
import { ScoreModule } from './score/score.module';
import { AdvanceNoticeModule } from './advance-notice/advance-notice.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { DiscordBotModule } from './discord-bot/discord-bot.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Core modules
    AuthModule,
    UsersModule,
    AttendanceModule,
    LeaveModule,
    RetroClockModule,
    ScoreModule,
    AdvanceNoticeModule,
    SystemConfigModule,

    // External integrations
    IntegrationsModule,
    DiscordBotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
