import { Controller, Get, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminGuard } from './admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface AiModelInfo {
  id: string;
  name: string;
  provider: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow?: number;
}

const COST_DATABASE: Record<string, { input: number; output: number; name: string }> = {
  // OpenAI
  'gpt-4o': { input: 5.0, output: 15.0, name: 'GPT-4o' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, name: 'GPT-4o Mini' },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, name: 'GPT-3.5 Turbo' },
  // Anthropic
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, name: 'Claude 3.5 Sonnet' },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0, name: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0, name: 'Claude 3.5 Haiku' },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0, name: 'Claude 3 Opus' },
  // Gemini
  'gemini-2.5-flash': { input: 0.075, output: 0.30, name: 'Gemini 2.5 Flash' },
  'gemini-2.0-flash': { input: 0.10, output: 0.40, name: 'Gemini 2.0 Flash' },
  'gemini-1.5-pro': { input: 1.25, output: 5.0, name: 'Gemini 1.5 Pro' },
};

@Controller('admin/ai')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminAiController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('models')
  async getAvailableModels() {
    const models: AiModelInfo[] = [];

    // 1. Fetch Gemini Models
    const geminiKey = await this.settingsService.getValue('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        // The new SDK for Gemini does not easily list models via ai.models.list() in a standard format
        // We will hardcode the primary ones for Gemini since its listing API requires specific scopes
        const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
        for (const m of geminiModels) {
          const cost = COST_DATABASE[m];
          models.push({
            id: m,
            name: cost?.name || m,
            provider: 'Google Gemini',
            inputCostPer1M: cost?.input || 0,
            outputCostPer1M: cost?.output || 0,
          });
        }
      } catch (e) {
        console.error('Failed to load Gemini models', e);
      }
    }

    // 2. Fetch OpenAI Models
    const openaiKey = await this.settingsService.getValue('OPENAI_API_KEY');
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const list = await openai.models.list();
        const available = list.data.filter(m => COST_DATABASE[m.id] || m.id.includes('gpt'));
        for (const m of available) {
          const cost = COST_DATABASE[m.id];
          models.push({
            id: m.id,
            name: cost?.name || m.id,
            provider: 'OpenAI',
            inputCostPer1M: cost?.input || 0,
            outputCostPer1M: cost?.output || 0,
          });
        }
      } catch (e) {
        console.error('Failed to fetch OpenAI models', e);
      }
    }

    // 3. Fetch Anthropic Models
    const anthropicKey = await this.settingsService.getValue('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const list = await anthropic.models.list();
        for (const m of list.data) {
          const cost = COST_DATABASE[m.id];
          models.push({
            id: m.id,
            name: cost?.name || m.display_name || m.id,
            provider: 'Anthropic',
            inputCostPer1M: cost?.input || 0,
            outputCostPer1M: cost?.output || 0,
          });
        }
      } catch (e) {
        console.error('Failed to fetch Anthropic models', e);
      }
    }

    return models;
  }
}
