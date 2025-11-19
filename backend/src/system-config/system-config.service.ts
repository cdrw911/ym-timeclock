import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SystemConfigValues {
  // Schedule
  work_start_time: string;
  work_end_time: string;
  lunch_start_time: string;
  lunch_end_time: string;

  // Rules
  late_grace_minutes: number;
  advance_notice_minutes: number;
  advance_notice_late_limit: number;

  // Scoring
  late_points_with_notice: Record<string, number>;
  late_points_no_notice: Record<string, number>;
  early_leave_first_time: number;
  early_leave_repeat: number;
  retro_clock_limit: Record<string, number>;
  perfect_attendance_bonus: number;

  // Security
  token_expiry_days: number;
}

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private configCache: Map<string, any> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.initializeDefaultConfigs();
    await this.loadAllConfigs();
  }

  /**
   * Initialize default system configurations
   */
  private async initializeDefaultConfigs() {
    const defaultConfigs = [
      // Schedule configs
      {
        key: 'work_start_time',
        value: JSON.stringify('08:30'),
        category: 'schedule',
        description: '標準上班時間',
      },
      {
        key: 'work_end_time',
        value: JSON.stringify('18:00'),
        category: 'schedule',
        description: '標準下班時間',
      },
      {
        key: 'lunch_start_time',
        value: JSON.stringify('12:00'),
        category: 'schedule',
        description: '午休開始時間',
      },
      {
        key: 'lunch_end_time',
        value: JSON.stringify('13:30'),
        category: 'schedule',
        description: '午休結束時間',
      },

      // Rules configs
      {
        key: 'late_grace_minutes',
        value: JSON.stringify(5),
        category: 'rules',
        description: '遲到寬限時間（分鐘）',
      },
      {
        key: 'advance_notice_minutes',
        value: JSON.stringify(30),
        category: 'rules',
        description: '預先告知時限（上班前 N 分鐘）',
      },
      {
        key: 'advance_notice_late_limit',
        value: JSON.stringify(3),
        category: 'rules',
        description: '預先告知遲到免扣分上限（次/月）',
      },

      // Scoring configs
      {
        key: 'late_points_with_notice',
        value: JSON.stringify({ '<=30': 0, '>30': -1 }),
        category: 'scoring',
        description: '預先告知遲到扣分規則',
      },
      {
        key: 'late_points_no_notice',
        value: JSON.stringify({ '<=30': -1, '30-60': -2, '>60': -3 }),
        category: 'scoring',
        description: '未預先告知遲到扣分規則',
      },
      {
        key: 'early_leave_first_time',
        value: JSON.stringify(-3),
        category: 'scoring',
        description: '第一次早退扣分',
      },
      {
        key: 'early_leave_repeat',
        value: JSON.stringify(-5),
        category: 'scoring',
        description: '第二次起早退扣分',
      },
      {
        key: 'retro_clock_limit',
        value: JSON.stringify({ '1-2': 0, '3-4': -1, '>=5': -2 }),
        category: 'scoring',
        description: '補打卡扣分規則（次數:扣分）',
      },
      {
        key: 'perfect_attendance_bonus',
        value: JSON.stringify(3),
        category: 'scoring',
        description: '全勤獎勵加分',
      },

      // Security configs
      {
        key: 'token_expiry_days',
        value: JSON.stringify(30),
        category: 'security',
        description: 'Token 過期天數',
      },
    ];

    // Create system admin user if doesn't exist for config updates
    let systemAdmin = await this.prisma.user.findFirst({
      where: { role: 'SYSTEM_ADMIN' },
    });

    if (!systemAdmin) {
      systemAdmin = await this.prisma.user.create({
        data: {
          code: 'SYSTEM',
          name: 'System Administrator',
          email: 'system@timeclock.internal',
          role: 'SYSTEM_ADMIN',
        },
      });
      this.logger.log('Created system administrator user');
    }

    for (const config of defaultConfigs) {
      const existing = await this.prisma.systemConfig.findUnique({
        where: { key: config.key },
      });

      if (!existing) {
        await this.prisma.systemConfig.create({
          data: {
            ...config,
            updatedBy: systemAdmin.id,
          },
        });
        this.logger.log(`Initialized config: ${config.key}`);
      }
    }
  }

  /**
   * Load all configurations into cache
   */
  private async loadAllConfigs() {
    const configs = await this.prisma.systemConfig.findMany();
    for (const config of configs) {
      try {
        this.configCache.set(config.key, JSON.parse(config.value));
      } catch (error) {
        this.logger.error(
          `Failed to parse config ${config.key}: ${error.message}`,
        );
      }
    }
    this.logger.log(`Loaded ${configs.length} configurations`);
  }

  /**
   * Get a configuration value
   */
  async get<T = any>(key: string): Promise<T> {
    if (this.configCache.has(key)) {
      return this.configCache.get(key) as T;
    }

    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new Error(`Configuration ${key} not found`);
    }

    const value = JSON.parse(config.value);
    this.configCache.set(key, value);
    return value as T;
  }

  /**
   * Set a configuration value
   */
  async set(key: string, value: any, updatedBy: string): Promise<void> {
    const stringValue = JSON.stringify(value);

    await this.prisma.systemConfig.update({
      where: { key },
      data: {
        value: stringValue,
        updatedBy,
      },
    });

    this.configCache.set(key, value);
    this.logger.log(`Updated config: ${key}`);
  }

  /**
   * Get all configurations by category
   */
  async getByCategory(category: string) {
    const configs = await this.prisma.systemConfig.findMany({
      where: { category },
    });

    return configs.map((config) => ({
      key: config.key,
      value: JSON.parse(config.value),
      description: config.description,
    }));
  }

  /**
   * Get all system configurations
   */
  async getAll(): Promise<Partial<SystemConfigValues>> {
    const config: any = {};
    for (const [key, value] of this.configCache.entries()) {
      config[key] = value;
    }
    return config;
  }

  /**
   * Reload configurations from database
   */
  async reload() {
    this.configCache.clear();
    await this.loadAllConfigs();
  }
}
