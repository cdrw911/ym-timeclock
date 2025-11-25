import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SYSTEM_ADMIN')
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  @Get()
  async getAll() {
    return this.configService.getAll();
  }

  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    return this.configService.getByCategory(category);
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    const value = await this.configService.get(key);
    return { key, value };
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body('value') value: any,
    @Request() req,
  ) {
    await this.configService.set(key, value, req.user.userId);
    return {
      message: 'Configuration updated successfully',
      key,
      value,
    };
  }

  @Put('reload')
  async reload() {
    await this.configService.reload();
    return { message: 'Configurations reloaded successfully' };
  }
}
