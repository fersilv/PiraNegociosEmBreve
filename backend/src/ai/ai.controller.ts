import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import type { JobSkillScore } from './job-skills.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';

@Controller('ai')
@UseGuards(FirebaseAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly jobSkillsService: JobSkillsService,
  ) {}

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

  @Post('suggest-job-skills')
  async suggestJobSkills(
    @Body()
    body: { title?: string; description?: string; requirements?: string },
  ) {
    return this.jobSkillsService.suggestSkills(
      body.title || '',
      body.description || '',
      body.requirements || '',
    );
  }

  @Post('skill-compatibility')
  async skillCompatibility(
    @Body() body: { candidateSkills?: unknown; jobSkills?: unknown },
  ) {
    return this.jobSkillsService.scoreCompatibility(
      body.candidateSkills,
      body.jobSkills,
    );
  }

  @Post('job-match')
  async jobMatch(
    @Body()
    body: { profile?: unknown; jobs?: unknown[]; applications?: unknown[] },
  ) {
    if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
      throw new BadRequestException('Nenhuma vaga foi enviada para análise.');
    }

    const [generalResult, skillResult] = await Promise.all([
      this.aiService.matchJobs(
        body.profile,
        body.jobs,
        Array.isArray(body.applications) ? body.applications : [],
      ),
      this.jobSkillsService.scoreJobs(body.profile, body.jobs),
    ]);

    const skillScores = new Map<string, JobSkillScore>(
      skillResult.scores.map((item: JobSkillScore) => [item.jobId, item]),
    );

    const matches = Array.isArray(generalResult?.matches)
      ? generalResult.matches.map((match: any) => {
          const skill = skillScores.get(String(match?.jobId || ''));
          const originalReason = String(match?.reason || '').trim();
          const skillSentence = skill
            ? `Compatibilidade de habilidades: ${Math.round(skill.score)}%.`
            : '';

          return {
            ...match,
            reason: [originalReason, skillSentence].filter(Boolean).join(' '),
            skillScore: skill?.score ?? null,
            skillMatches: skill?.matches ?? [],
          };
        })
      : [];

    return { ...generalResult, matches };
  }
}
