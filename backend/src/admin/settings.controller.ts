import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminGuard } from './admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';

@Controller('admin/settings')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAllSettings() {
    const settings = await this.settingsService.findAll();
    // Return key-value map for easier frontend consumption
    const map = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);
    return map;
  }

  @Post()
  async updateSetting(@Body() body: { key: string; value: string; description?: string }) {
    return this.settingsService.createOrUpdate(body.key, body.value, body.description);
  }
}
