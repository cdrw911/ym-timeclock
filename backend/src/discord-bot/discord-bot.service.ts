import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { AttendanceService } from '../attendance/attendance.service';
import { AdvanceNoticeService } from '../advance-notice/advance-notice.service';
import { ScoreService } from '../score/score.service';
import { PrismaService } from '../prisma/prisma.service';
import { startOfWeek, endOfWeek, format } from 'date-fns';

@Injectable()
export class DiscordBotService implements OnModuleInit {
  private readonly logger = new Logger(DiscordBotService.name);
  private client: Client;
  private rest: REST;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly advanceNoticeService: AdvanceNoticeService,
    private readonly scoreService: ScoreService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');

    if (!token || token === 'your-discord-bot-token') {
      this.logger.warn('Discord bot token not configured, skipping initialization');
      return;
    }

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    this.rest = new REST({ version: '10' }).setToken(token);

    await this.registerCommands();
    await this.setupEventHandlers();
    await this.client.login(token);

    this.logger.log('Discord bot initialized');
  }

  /**
   * Register slash commands
   */
  private async registerCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName('in')
        .setDescription('Clock in')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Work type')
            .setRequired(true)
            .addChoices(
              { name: 'Onsite', value: 'onsite' },
              { name: 'Remote', value: 'remote' },
            ),
        ),
      new SlashCommandBuilder()
        .setName('out')
        .setDescription('Clock out'),
      new SlashCommandBuilder()
        .setName('break_start')
        .setDescription('Start break'),
      new SlashCommandBuilder()
        .setName('break_end')
        .setDescription('End break'),
      new SlashCommandBuilder()
        .setName('today')
        .setDescription('View today\'s attendance'),
      new SlashCommandBuilder()
        .setName('my_score')
        .setDescription('View monthly score')
        .addStringOption((option) =>
          option
            .setName('month')
            .setDescription('Month (YYYY-MM)')
            .setRequired(false),
        ),
      new SlashCommandBuilder()
        .setName('advance_notice')
        .setDescription('Submit advance notice')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Notice type')
            .setRequired(true)
            .addChoices(
              { name: 'Late', value: 'LATE' },
              { name: 'Leave', value: 'LEAVE' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription('Expected date (YYYY-MM-DD)')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Reason')
            .setRequired(true),
        ),
    ];

    try {
      const guildId = this.configService.get<string>('DISCORD_GUILD_ID');

      if (!guildId || guildId === 'your-discord-guild-id') {
        this.logger.warn('Discord guild ID not configured');
        return;
      }

      await this.rest.put(
        Routes.applicationGuildCommands(
          this.client.user?.id || '',
          guildId,
        ),
        { body: commands.map((cmd) => cmd.toJSON()) },
      );

      this.logger.log('Discord slash commands registered');
    } catch (error) {
      this.logger.error(`Failed to register commands: ${error.message}`);
    }
  }

  /**
   * Setup event handlers
   */
  private async setupEventHandlers() {
    this.client.on('ready', () => {
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        // Find user by Discord ID
        const user = await this.prisma.user.findUnique({
          where: { discordId: interaction.user.id },
        });

        if (!user) {
          await interaction.reply({
            content: 'Your Discord account is not linked to a user account.',
            ephemeral: true,
          });
          return;
        }

        await this.handleCommand(interaction, user.id);
      } catch (error) {
        this.logger.error(`Command error: ${error.message}`);
        await interaction.reply({
          content: 'An error occurred while processing your command.',
          ephemeral: true,
        });
      }
    });
  }

  /**
   * Handle slash commands
   */
  private async handleCommand(interaction: any, userId: string) {
    const { commandName } = interaction;

    switch (commandName) {
      case 'in':
        await this.handleClockIn(interaction, userId);
        break;
      case 'out':
        await this.handleClockOut(interaction, userId);
        break;
      case 'break_start':
        await this.handleBreakStart(interaction, userId);
        break;
      case 'break_end':
        await this.handleBreakEnd(interaction, userId);
        break;
      case 'today':
        await this.handleToday(interaction, userId);
        break;
      case 'my_score':
        await this.handleMyScore(interaction, userId);
        break;
      case 'advance_notice':
        await this.handleAdvanceNotice(interaction, userId);
        break;
      default:
        await interaction.reply({
          content: 'Unknown command',
          ephemeral: true,
        });
    }
  }

  private async handleClockIn(interaction: any, userId: string) {
    const type = interaction.options.getString('type');
    const result = await this.attendanceService.clockIn(userId, {
      type,
      source: 'DISCORD',
    });
    await interaction.reply({
      content: `✅ Clocked in (${type}) at ${result.timestamp.toLocaleTimeString('zh-TW')}`,
      ephemeral: true,
    });
  }

  private async handleClockOut(interaction: any, userId: string) {
    const result = await this.attendanceService.clockOut(userId, {
      source: 'DISCORD',
    });
    await interaction.reply({
      content: `✅ Clocked out at ${result.timestamp.toLocaleTimeString('zh-TW')}\nWork hours: ${(result.summary.totalWorkSeconds / 3600).toFixed(2)}h`,
      ephemeral: true,
    });
  }

  private async handleBreakStart(interaction: any, userId: string) {
    await this.attendanceService.breakStart(userId, { source: 'DISCORD' });
    await interaction.reply({
      content: '✅ Break started',
      ephemeral: true,
    });
  }

  private async handleBreakEnd(interaction: any, userId: string) {
    await this.attendanceService.breakEnd(userId, { source: 'DISCORD' });
    await interaction.reply({
      content: '✅ Break ended',
      ephemeral: true,
    });
  }

  private async handleToday(interaction: any, userId: string) {
    const status = await this.attendanceService.getTodayStatus(userId);
    const summary = status.summary;

    let message = '📊 Today\'s Attendance\n';
    if (!summary) {
      message += 'No records yet today';
    } else {
      message += `Work hours: ${(summary.totalWorkSeconds / 3600).toFixed(2)}h\n`;
      message += `Onsite: ${(summary.workOnsiteSeconds / 3600).toFixed(2)}h\n`;
      message += `Remote: ${(summary.workRemoteSeconds / 3600).toFixed(2)}h\n`;
      if (summary.isLate) {
        message += `⚠️ Late: ${summary.lateMinutes} minutes\n`;
      }
      if (summary.isEarlyLeave) {
        message += `⚠️ Early leave: ${summary.earlyLeaveMinutes} minutes\n`;
      }
    }

    await interaction.reply({ content: message, ephemeral: true });
  }

  private async handleMyScore(interaction: any, userId: string) {
    const month =
      interaction.options.getString('month') ||
      new Date().toISOString().slice(0, 7);

    // This would call ScoreService, but we'll skip for now
    await interaction.reply({
      content: `📊 Score for ${month}: Coming soon...`,
      ephemeral: true,
    });
  }

  private async handleAdvanceNotice(interaction: any, userId: string) {
    const type = interaction.options.getString('type');
    const date = interaction.options.getString('date');
    const reason = interaction.options.getString('reason');

    await this.advanceNoticeService.create(userId, {
      type,
      expectedDate: date,
      reason,
      source: 'DISCORD',
    });

    await interaction.reply({
      content: `✅ Advance notice submitted for ${date}`,
      ephemeral: true,
    });
  }

  /**
   * Send notification to user
   */
  async sendNotification(discordId: string, message: string) {
    if (!this.client || !this.client.isReady()) {
      this.logger.warn('Discord bot not ready');
      return;
    }

    try {
      const user = await this.client.users.fetch(discordId);
      await user.send(message);
      this.logger.log(`Notification sent to ${discordId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Send message to announcement channel
   */
  private async sendToChannel(channelId: string, message: string) {
    if (!this.client || !this.client.isReady()) {
      this.logger.warn('Discord bot not ready');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).send(message);
        this.logger.log(`Message sent to channel ${channelId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send message to channel: ${error.message}`);
    }
  }

  /**
   * Check for users who haven't clocked in (runs at 08:45 - 15 minutes after standard start time)
   */
  @Cron('45 8 * * 1-5', { timeZone: 'Asia/Taipei' })
  async checkMissingClockIn() {
    if (!this.client || !this.client.isReady()) {
      return;
    }

    this.logger.log('Checking for missing clock-in...');

    try {
      const today = new Date();
      const users = await this.prisma.user.findMany({
        where: {
          role: 'INTERN',
          isActive: true,
          discordId: { not: null },
        },
        include: {
          internshipTerms: {
            where: {
              status: 'CONFIRMED',
              startDate: { lte: today },
              endDate: { gte: today },
            },
          },
        },
      });

      for (const user of users) {
        if (!user.discordId || user.internshipTerms.length === 0) continue;

        // Check if user has clocked in today
        const todayStart = new Date(today.setHours(0, 0, 0, 0));
        const events = await this.prisma.attendanceEvent.findMany({
          where: {
            userId: user.id,
            timestamp: { gte: todayStart },
            type: { in: ['WORK_ONSITE_START', 'WORK_REMOTE_START'] },
          },
        });

        if (events.length === 0) {
          await this.sendNotification(
            user.discordId,
            `⚠️ 提醒：您今天還沒有打卡！\n請盡快使用 /in 指令或至網頁打卡。`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check missing clock-in: ${error.message}`);
    }
  }

  /**
   * Check for users who haven't clocked out (runs at 18:30 - 30 minutes after standard end time)
   */
  @Cron('30 18 * * 1-5', { timeZone: 'Asia/Taipei' })
  async checkMissingClockOut() {
    if (!this.client || !this.client.isReady()) {
      return;
    }

    this.logger.log('Checking for missing clock-out...');

    try {
      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0));

      const users = await this.prisma.user.findMany({
        where: {
          role: 'INTERN',
          isActive: true,
          discordId: { not: null },
        },
      });

      for (const user of users) {
        if (!user.discordId) continue;

        // Check if user has clocked in but not out
        const events = await this.prisma.attendanceEvent.findMany({
          where: {
            userId: user.id,
            timestamp: { gte: todayStart },
          },
          orderBy: { timestamp: 'desc' },
        });

        if (events.length > 0) {
          const lastEvent = events[0];
          if (
            lastEvent.type === 'WORK_ONSITE_START' ||
            lastEvent.type === 'WORK_REMOTE_START' ||
            lastEvent.type === 'BREAK_OFFSITE_END'
          ) {
            await this.sendNotification(
              user.discordId,
              `⚠️ 提醒：您今天還沒有下班打卡！\n請記得使用 /out 指令或至網頁打卡。`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check missing clock-out: ${error.message}`);
    }
  }

  /**
   * Send weekly summary (runs every Monday at 9:00)
   */
  @Cron('0 9 * * 1', { timeZone: 'Asia/Taipei' })
  async sendWeeklySummary() {
    if (!this.client || !this.client.isReady()) {
      return;
    }

    this.logger.log('Sending weekly summary...');

    try {
      const channelId = this.configService.get<string>('DISCORD_ANNOUNCEMENT_CHANNEL_ID');
      if (!channelId || channelId === 'your-channel-id') {
        this.logger.warn('Announcement channel not configured');
        return;
      }

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get all active interns
      const users = await this.prisma.user.findMany({
        where: {
          role: 'INTERN',
          isActive: true,
        },
      });

      let message = `📊 **上週出勤統計** (${format(weekStart, 'yyyy-MM-dd')} ~ ${format(weekEnd, 'yyyy-MM-dd')})\n\n`;

      for (const user of users) {
        const summaries = await this.prisma.daySummary.findMany({
          where: {
            userId: user.id,
            date: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
        });

        const totalHours = summaries.reduce((sum, s) => sum + s.totalWorkSeconds, 0) / 3600;
        const lateDays = summaries.filter((s) => s.isLate).length;
        const earlyLeaveDays = summaries.filter((s) => s.isEarlyLeave).length;

        message += `**${user.name}** (${user.code}):\n`;
        message += `  出勤: ${summaries.length} 天 | 總工時: ${totalHours.toFixed(1)}h\n`;
        if (lateDays > 0) message += `  ⚠️ 遲到: ${lateDays} 次\n`;
        if (earlyLeaveDays > 0) message += `  ⚠️ 早退: ${earlyLeaveDays} 次\n`;
        message += `\n`;
      }

      message += `\n請持續保持良好的出勤習慣！💪`;

      await this.sendToChannel(channelId, message);
    } catch (error) {
      this.logger.error(`Failed to send weekly summary: ${error.message}`);
    }
  }

  /**
   * Send monthly score ranking (runs on the 1st of every month at 10:00)
   */
  @Cron('0 10 1 * *', { timeZone: 'Asia/Taipei' })
  async sendMonthlyScoreRanking() {
    if (!this.client || !this.client.isReady()) {
      return;
    }

    this.logger.log('Sending monthly score ranking...');

    try {
      const channelId = this.configService.get<string>('DISCORD_ANNOUNCEMENT_CHANNEL_ID');
      if (!channelId || channelId === 'your-channel-id') {
        this.logger.warn('Announcement channel not configured');
        return;
      }

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const yearMonth = format(lastMonth, 'yyyy-MM');

      // Get all scores for last month
      const scores = await this.prisma.scoreRecord.findMany({
        where: {
          yearMonth,
          status: 'FINAL',
        },
        include: {
          user: true,
        },
        orderBy: {
          finalScore: 'desc',
        },
      });

      let message = `🏆 **${yearMonth} 出勤分數排行榜**\n\n`;

      scores.forEach((score, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const grade = this.getGrade(score.finalScore);

        message += `${medal} **${score.user.name}** - ${score.finalScore.toFixed(1)}分 (${grade})\n`;
      });

      message += `\n恭喜上榜的實習生！繼續加油！🎉`;

      await this.sendToChannel(channelId, message);

      // Also send individual notifications
      for (const score of scores) {
        if (score.user.discordId) {
          const details = await this.prisma.scoreDetail.findMany({
            where: { scoreRecordId: score.id },
          });

          let userMessage = `📊 **您的 ${yearMonth} 出勤分數**\n\n`;
          userMessage += `總分: **${score.finalScore.toFixed(1)}** / 100\n`;
          userMessage += `排名: ${scores.findIndex((s) => s.id === score.id) + 1} / ${scores.length}\n`;
          userMessage += `等第: ${this.getGrade(score.finalScore)}\n\n`;

          if (details.length > 0) {
            userMessage += `扣分明細:\n`;
            details.forEach((d) => {
              if (d.pointsDelta < 0) {
                userMessage += `  • ${d.reasonType}: ${d.pointsDelta} (${format(d.relatedDate, 'MM/dd')})\n`;
              }
            });
          }

          if (score.bonusPoints > 0) {
            userMessage += `\n✨ 獎勵加分: +${score.bonusPoints}\n`;
          }

          await this.sendNotification(score.user.discordId, userMessage);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send monthly score ranking: ${error.message}`);
    }
  }

  /**
   * Notify user when leave/retro request is reviewed
   */
  async notifyRequestReviewed(
    userId: string,
    type: 'leave' | 'retro',
    status: 'approved' | 'rejected',
    notes?: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.discordId) {
        return;
      }

      const typeText = type === 'leave' ? '請假' : '補打卡';
      const statusText = status === 'approved' ? '✅ 已核准' : '❌ 已駁回';

      let message = `${statusText} - 您的${typeText}申請\n`;
      if (notes) {
        message += `\n審核備註: ${notes}`;
      }

      await this.sendNotification(user.discordId, message);
    } catch (error) {
      this.logger.error(`Failed to notify request reviewed: ${error.message}`);
    }
  }

  private getGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C';
    return 'D';
  }
}
