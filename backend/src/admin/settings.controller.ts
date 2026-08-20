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
    const map = settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, string>,
    );
    return map;
  }

  @Post()
  async updateSetting(
    @Body() body: { key: string; value: string; description?: string },
  ) {
    const result = await this.settingsService.createOrUpdate(
      body.key,
      body.value,
      body.description,
    );

    const providerByKey: Record<string, string> = {
      GEMINI_API_KEY: 'GEMINI',
      OPENAI_API_KEY: 'OPENAI',
      ANTHROPIC_API_KEY: 'ANTHROPIC',
    };
    const changedProvider = providerByKey[body.key];
    if (changedProvider) {
      const activeProvider = await this.settingsService.getValue('AI_PROVIDER');
      const enabled =
        (await this.settingsService.getValue('AI_ENABLED', 'false')) === 'true';
      if (enabled && activeProvider === changedProvider) {
        await this.settingsService.createOrUpdate(
          'AI_ENABLED',
          'false',
          'Habilita os recursos de inteligência artificial no sistema',
        );
      }
    }

    return result;
  }
}
