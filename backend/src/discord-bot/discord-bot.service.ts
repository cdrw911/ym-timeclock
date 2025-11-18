import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { AttendanceService } from '../attendance/attendance.service';
import { AdvanceNoticeService } from '../advance-notice/advance-notice.service';
import { PrismaService } from '../prisma/prisma.service';

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
}
