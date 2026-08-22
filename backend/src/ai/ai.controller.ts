import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
  Param,
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
import {
  ResumeImprovementService,
  type ResumeImprovementProposal,
} from './resume-improvement.service';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { User } from '../users/entities/user.entity';
import { PaymentsService } from '../payments/payments.service';

@Controller('ai')
@UseGuards(FirebaseAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly jobSkillsService: JobSkillsService,
    private readonly resumeImportService: ResumeImportService,
    private readonly resumeReviewService: ResumeReviewService,
    private readonly resumeImprovementService: ResumeImprovementService,
    private readonly paymentsService: PaymentsService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private async requireUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Perfil de usuário não encontrado.');
    return user;
  }

  @Get('status')
  async getStatus(@Req() req: any) {
    const [status, user, reanalysisProduct, improvementProduct, importProduct, credits] = await Promise.all([
      this.aiService.getStatus(),
      this.usersRepository.findOne({ where: { id: req.user.uid } }),
      this.paymentsService.findProduct('RESUME_REANALYSIS', true),
      this.paymentsService.findProduct('RESUME_AI_IMPROVEMENT', true),
      this.paymentsService.findProduct('RESUME_AI_IMPORT', true),
      this.paymentsService.getCredits(req.user.uid),
    ]);

    const analysisCount = Number(user?.aiAnalysisCount || 0);
    const freeAnalysisLimit = user?.aiAnalysisLimit ?? Number(reanalysisProduct.freeUses ?? 1);
    const freeResumeAnalysisAvailable = analysisCount < freeAnalysisLimit;
    const hasSavedResumeAnalysis = Boolean(user?.aiAnalysis && user?.hasAiAnalyzed);
    const reanalysisFreeNow = Boolean(reanalysisProduct.enabled) && Number(reanalysisProduct.effectivePriceCents || 0) === 0;
    const resumeReanalysisPaymentRequired =
      Boolean(reanalysisProduct.enabled) &&
      Number(reanalysisProduct.effectivePriceCents || 0) > 0 &&
      !user?.resumeScoreUnlocked &&
      !freeResumeAnalysisAvailable &&
      Number(credits.RESUME_REANALYSIS || 0) <= 0;

    // A nota já conquistada permanece visível. O paywall só existe para gerar uma nova análise.
    const resumeScorePaymentRequired = resumeReanalysisPaymentRequired && !hasSavedResumeAnalysis;

    const importCount = Number(user?.aiImportCount || 0);
    const freeImportLimit = user?.aiImportLimit ?? Number(importProduct.freeUses ?? 1);
    const freeResumeImportAvailable = importCount < freeImportLimit;
    const importFreeNow = Boolean(importProduct.enabled) && Number(importProduct.effectivePriceCents || 0) === 0;
    const resumeImportPaymentRequired =
      Boolean(importProduct.enabled) &&
      Number(importProduct.effectivePriceCents || 0) > 0 &&
      !freeResumeImportAvailable &&
      Number(credits.RESUME_AI_IMPORT || 0) <= 0;

    const improvementFreeNow = Boolean(improvementProduct.enabled) && Number(improvementProduct.effectivePriceCents || 0) === 0;
    const resumeImprovementPaymentRequired =
      Boolean(improvementProduct.enabled) &&
      Number(improvementProduct.effectivePriceCents || 0) > 0 &&
      Number(credits.RESUME_AI_IMPROVEMENT || 0) <= 0;

    return {
      ...status,
      resumeScorePaymentRequired,
      resumeReanalysisPaymentRequired,
      resumeImprovementPaymentRequired,
      resumeImportPaymentRequired,
      freeResumeAnalysisAvailable,
      freeResumeImportAvailable,
      hasSavedResumeAnalysis,
      resumeAnalysisCount: analysisCount,
      resumeImportCount: importCount,
      credits,
      products: {
        reanalysis: reanalysisProduct,
        improvement: improvementProduct,
        import: importProduct,
      },
      availability: {
        reanalysis: freeResumeAnalysisAvailable || reanalysisFreeNow || Number(credits.RESUME_REANALYSIS || 0) > 0 || Boolean(user?.resumeScoreUnlocked) || Boolean(reanalysisProduct.enabled),
        improvement: improvementFreeNow || Number(credits.RESUME_AI_IMPROVEMENT || 0) > 0 || Boolean(improvementProduct.enabled),
        import: freeResumeImportAvailable || importFreeNow || Number(credits.RESUME_AI_IMPORT || 0) > 0 || Boolean(importProduct.enabled),
      },
    };
  }

  private async runResumeImport(userId: string, documents: ResumeSourceDocumentInput[]) {
    const [user, product, credits] = await Promise.all([
      this.requireUser(userId),
      this.paymentsService.findProduct('RESUME_AI_IMPORT', true),
      this.paymentsService.getCredits(userId),
    ]);
    const count = Number(user.aiImportCount || 0);
    const freeLimit = user.aiImportLimit ?? Number(product.freeUses ?? 1);
    const freeAvailable = count < freeLimit;
    const freeNow = Boolean(product.enabled) && Number(product.effectivePriceCents || 0) === 0;
    const paidCreditAvailable = Number(credits.RESUME_AI_IMPORT || 0) > 0;

    if (!freeAvailable && !freeNow && !paidCreditAvailable) {
      if (!product.enabled) {
        throw new ForbiddenException({
          code: 'AI_IMPORT_UNAVAILABLE',
          message: 'Sua primeira organização por IA já foi utilizada e novas importações estão temporariamente indisponíveis.',
        });
      }
      throw new ForbiddenException({
        code: 'PAYMENT_REQUIRED',
        productCode: product.code,
        product,
        message: 'Sua primeira organização por IA já foi utilizada. Uma nova importação requer um crédito.',
      });
    }

    let consumed = false;
    if (!freeAvailable && !freeNow && paidCreditAvailable) {
      await this.paymentsService.consumeCredit(userId, 'RESUME_AI_IMPORT');
      consumed = true;
    }

    try {
      const result = await this.resumeImportService.importDocuments(documents);
      user.aiImportCount = count + 1;
      await this.usersRepository.save(user);
      return result;
    } catch (error) {
      if (consumed) await this.paymentsService.grantCredit(userId, 'RESUME_AI_IMPORT', 1).catch(() => undefined);
      throw error;
    }
  }

  @Post('analyze-resume')
  async analyzeResume(
    @Req() req: any,
    @Body() body: { base64File: string; mimeType: string },
  ) {
    if (!body.base64File) {
      throw new BadRequestException('Nenhum arquivo de currículo enviado.');
    }
    return this.runResumeImport(req.user.uid, [
      {
        base64File: body.base64File,
        mimeType: body.mimeType,
        fileName: 'curriculo',
      },
    ]);
  }

  @Post('analyze-resume-documents')
  async analyzeResumeDocuments(
    @Req() req: any,
    @Body() body: { documents?: ResumeSourceDocumentInput[] },
  ) {
    return this.runResumeImport(req.user.uid, body.documents || []);
  }

  @Post('review-resume')
  async reviewResume(@Req() req: any, @Body() body: { profile?: unknown }) {
    if (!body || !body.profile) {
      throw new BadRequestException('Envie os dados do currículo para avaliação.');
    }

    const [user, product, credits] = await Promise.all([
      this.requireUser(req.user.uid),
      this.paymentsService.findProduct('RESUME_REANALYSIS', true),
      this.paymentsService.getCredits(req.user.uid),
    ]);

    const analysisCount = Number(user.aiAnalysisCount || 0);
    const freeAnalysisLimit = user.aiAnalysisLimit ?? Number(product.freeUses ?? 1);
    const freeAvailable = analysisCount < freeAnalysisLimit;
    const freeNow = Boolean(product.enabled) && Number(product.effectivePriceCents || 0) === 0;
    const paidCreditAvailable = Number(credits.RESUME_REANALYSIS || 0) > 0;
    const canRunNewAnalysis = user.resumeScoreUnlocked || freeAvailable || freeNow || paidCreditAvailable;

    if (!canRunNewAnalysis) {
      if (!product.enabled) {
        throw new ForbiddenException({
          code: 'REANALYSIS_UNAVAILABLE',
          message: 'Sua análise gratuita continua disponível para consulta, mas novas análises estão temporariamente indisponíveis.',
        });
      }
      throw new ForbiddenException({
        code: 'PAYMENT_REQUIRED',
        productCode: product.code,
        product,
        message: 'Sua análise gratuita já foi utilizada. Uma nova análise requer um crédito.',
      });
    }

    let consumed = false;
    if (!user.resumeScoreUnlocked && !freeAvailable && !freeNow && paidCreditAvailable) {
      await this.paymentsService.consumeCredit(req.user.uid, 'RESUME_REANALYSIS');
      consumed = true;
    }

    try {
      const analysis = await this.resumeReviewService.review(body.profile);
      user.aiAnalysis = analysis as unknown as Record<string, unknown>;
      user.hasAiAnalyzed = true;
      user.aiAnalysisCount = analysisCount + 1;
      await this.usersRepository.save(user);
      await this.paymentsService.recordAnalysis(
        req.user.uid,
        body.profile,
        analysis as unknown as Record<string, unknown>,
        freeAvailable ? 'FREE' : 'REANALYSIS',
      );
      return analysis;
    } catch (error) {
      if (consumed) await this.paymentsService.grantCredit(req.user.uid, 'RESUME_REANALYSIS', 1).catch(() => undefined);
      throw error;
    }
  }

  @Post('improve-resume')
  async improveResume(@Req() req: any) {
    const [user, product, credits] = await Promise.all([
      this.requireUser(req.user.uid),
      this.paymentsService.findProduct('RESUME_AI_IMPROVEMENT', true),
      this.paymentsService.getCredits(req.user.uid),
    ]);
    const freeNow = Boolean(product.enabled) && Number(product.effectivePriceCents || 0) === 0;
    const paidCreditAvailable = Number(credits.RESUME_AI_IMPROVEMENT || 0) > 0;
    if (!freeNow && !paidCreditAvailable) {
      if (!product.enabled) {
        throw new ForbiddenException({ code: 'IMPROVEMENT_UNAVAILABLE', message: 'A otimização profissional por IA está temporariamente indisponível.' });
      }
      throw new ForbiddenException({
        code: 'PAYMENT_REQUIRED',
        productCode: product.code,
        product,
        message: 'A otimização profissional por IA requer um crédito.',
      });
    }

    let consumed = false;
    if (!freeNow && paidCreditAvailable) {
      await this.paymentsService.consumeCredit(req.user.uid, 'RESUME_AI_IMPROVEMENT');
      consumed = true;
    }
    try {
      const proposal = await this.resumeImprovementService.propose(user);
      const stored = await this.paymentsService.createImprovementProposal(req.user.uid, user, proposal as unknown as Record<string, unknown>);
      return { id: stored.id, status: stored.status, proposal };
    } catch (error) {
      if (consumed) await this.paymentsService.grantCredit(req.user.uid, 'RESUME_AI_IMPROVEMENT', 1).catch(() => undefined);
      throw error;
    }
  }

  @Post('improve-resume/:id/apply')
  async applyResumeImprovement(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { selectedChangeIds?: string[] },
  ) {
    const [user, stored] = await Promise.all([
      this.requireUser(req.user.uid),
      this.paymentsService.getImprovementProposal(req.user.uid, id),
    ]);
    if (stored.status !== 'PENDING') {
      throw new BadRequestException('Esta proposta de melhoria já foi concluída.');
    }
    const proposal = stored.proposal as ResumeImprovementProposal;
    const availableIds = new Set((proposal.changes || []).map((change) => change.id));
    const selectedIds = Array.from(new Set((body.selectedChangeIds || []).map(String))).filter((changeId) => availableIds.has(changeId));
    if (selectedIds.length === 0) throw new BadRequestException('Selecione ao menos uma melhoria para aplicar.');

    const patch = this.resumeImprovementService.applySelected(user, proposal, selectedIds);
    user.bio = patch.bio;
    user.skills = patch.skills;
    user.resumePreferences = patch.resumePreferences;
    user.experiences = patch.experiences;
    await this.usersRepository.save(user);

    const partial = selectedIds.length < (proposal.changes || []).length;
    await this.paymentsService.completeImprovementProposal(req.user.uid, id, selectedIds, partial);

    let analysis: any = null;
    let analysisError: string | null = null;
    const hasIncludedCredit = await this.paymentsService.hasCredit(req.user.uid, 'RESUME_REANALYSIS');
    if (hasIncludedCredit) await this.paymentsService.consumeCredit(req.user.uid, 'RESUME_REANALYSIS');
    try {
      const profileForReview = {
        ...user,
        uploadedResumeFile: undefined,
        publishedResumeSnapshot: undefined,
      };
      analysis = await this.resumeReviewService.review(profileForReview);
      user.aiAnalysis = analysis as Record<string, unknown>;
      user.hasAiAnalyzed = true;
      user.aiAnalysisCount = Number(user.aiAnalysisCount || 0) + 1;
      await this.usersRepository.save(user);
      await this.paymentsService.recordAnalysis(
        req.user.uid,
        profileForReview,
        analysis as Record<string, unknown>,
        'IMPROVEMENT',
      );
    } catch (error: any) {
      analysisError = error?.message || 'As melhorias foram aplicadas, mas a nova análise não pôde ser concluída agora.';
      if (hasIncludedCredit) await this.paymentsService.grantCredit(req.user.uid, 'RESUME_REANALYSIS', 1).catch(() => undefined);
    }

    return {
      applied: true,
      partial,
      selectedChangeIds: selectedIds,
      analysis,
      analysisError,
    };
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
