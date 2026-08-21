import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import type { JobSkillScore } from './job-skills.service';
import {
  ResumeImportService,
  type ResumeSourceDocumentInput,
} from './resume-import.service';
import { ResumeReviewService } from './resume-review.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { User } from '../users/entities/user.entity';

@Controller('ai')
@UseGuards(FirebaseAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly jobSkillsService: JobSkillsService,
    private readonly resumeImportService: ResumeImportService,
    private readonly resumeReviewService: ResumeReviewService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }

  private async invalidateResumeScore(userId: string) {
    await this.usersRepository.update(
      { id: userId },
      { aiAnalysis: null, hasAiAnalyzed: false },
    );
  }

  @Post('analyze-resume')
  async analyzeResume(
    @Req() req: any,
    @Body() body: { base64File: string; mimeType: string },
  ) {
    if (!body.base64File) {
      throw new BadRequestException('Nenhum arquivo de currículo enviado.');
    }
    const result = await this.resumeImportService.importDocuments([
      {
        base64File: body.base64File,
        mimeType: body.mimeType,
        fileName: 'curriculo',
      },
    ]);
    await this.invalidateResumeScore(req.user.uid);
    return result;
  }

  @Post('analyze-resume-documents')
  async analyzeResumeDocuments(
    @Req() req: any,
    @Body() body: { documents?: ResumeSourceDocumentInput[] },
  ) {
    const result = await this.resumeImportService.importDocuments(
      body.documents || [],
    );
    await this.invalidateResumeScore(req.user.uid);
    return result;
  }

  @Post('review-resume')
  async reviewResume(@Req() req: any, @Body() body: { profile?: unknown }) {
    if (!body || !body.profile) {
      throw new BadRequestException('Envie os dados do currículo para avaliação.');
    }

    const user = await this.usersRepository.findOne({
      where: { id: req.user.uid },
    });
    if (!user?.resumeScoreUnlocked) {
      throw new ForbiddenException(
        'A pontuação detalhada do currículo é um recurso premium e ainda não está desbloqueada para esta conta.',
      );
    }

    const analysis = await this.resumeReviewService.review(body.profile);
    user.aiAnalysis = analysis as unknown as Record<string, unknown>;
    user.hasAiAnalyzed = true;
    user.aiAnalysisCount = Number(user.aiAnalysisCount || 0) + 1;
    await this.usersRepository.save(user);
    return analysis;
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
