import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';

@Controller('ai')
@UseGuards(FirebaseAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('analyze-resume')
  async analyzeResume(
    @Body() body: { base64File: string; mimeType: string },
  ) {
    if (!body.base64File) {
      throw new BadRequestException('Nenhum arquivo de currículo enviado.');
    }
    return this.aiService.analyzeResume(body.base64File, body.mimeType);
  }

  @Post('job-match')
  async jobMatch(
    @Body()
    body: { profile?: unknown; jobs?: unknown[]; applications?: unknown[] },
  ) {
    if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
      throw new BadRequestException('Nenhuma vaga foi enviada para análise.');
    }
    return this.aiService.matchJobs(
      body.profile,
      body.jobs,
      Array.isArray(body.applications) ? body.applications : [],
    );
  }
}
