import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import type { AiBrainEntryInput, AiBehaviorSettings } from './settings.service';
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
    const previousValue = await this.settingsService.getValue(body.key);
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
    if (changedProvider && previousValue !== body.value) {
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

  @Get('ai-behavior')
  getAiBehavior() {
    return this.settingsService.getAiBehavior();
  }

  @Post('ai-behavior')
  saveAiBehavior(@Body() body: Partial<AiBehaviorSettings>) {
    return this.settingsService.saveAiBehavior(body || {});
  }

  @Get('ai-brain')
  listAiBrain(@Query('q') search?: string) {
    return this.settingsService.listAiBrain(search);
  }

  @Post('ai-brain')
  createAiBrain(@Body() body: AiBrainEntryInput) {
    if (!String(body?.title || '').trim() || !String(body?.content || '').trim()) {
      throw new BadRequestException(
        'Título e conteúdo do aprendizado são obrigatórios.',
      );
    }
    return this.settingsService.createAiBrain(body);
  }

  @Patch('ai-brain/:id')
  updateAiBrain(
    @Param('id') id: string,
    @Body() body: AiBrainEntryInput,
  ) {
    return this.settingsService.updateAiBrain(id, body || {});
  }

  @Delete('ai-brain/:id')
  deleteAiBrain(@Param('id') id: string) {
    return this.settingsService.deleteAiBrain(id);
  }
}
