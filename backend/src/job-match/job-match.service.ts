import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { User, UserType } from '../users/entities/user.entity';
import { PaymentsService } from '../payments/payments.service';
import { BillingSupportService } from '../payments/billing-support.service';
import { JobMatchAiService, type JobMatchProfile, type WeightedJobRequirement } from './job-match-ai.service';

export const JOB_MATCH_ALGORITHM_VERSION = 'job-match-v2';
const GENERIC_ROLE_TOKENS = new Set(['operador','operadora','auxiliar','assistente','analista','ajudante','tecnico','tecnica','profissional','colaborador','colaboradora','funcionario','funcionaria']);
const STOP_WORDS = new Set(['a','o','as','os','de','da','do','das','dos','em','para','com','e','um','uma','na','no','por','que','ao','aos']);

@Injectable()
export class JobMatchService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly ai: JobMatchAiService,
    private readonly payments: PaymentsService,
    private readonly billingSupport: BillingSupportService,
  ) {}

  private normalize(value: unknown) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private tokens(value: unknown, ignoreGeneric = false) {
    return this.normalize(value).split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token) && (!ignoreGeneric || !GENERIC_ROLE_TOKENS.has(token)));
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private jobFingerprint(job: Job) {
    return this.hash({ title: job.title, description: job.description, requirements: job.requirements, skills: job.skills, type: job.type, workModel: job.workModel });
  }

  private resumeFingerprint(user: User) {
    return this.hash({
      bio: user.bio,
      experiences: user.experiences,
      education: user.education,
      skills: user.skills,
      courses: user.courses,
      languages: user.languages,
      jobPreferences: user.jobPreferences,
      city: user.city,
      state: user.state,
    });
  }

  async analyzeActiveJob(job: Job, force = false) {
    if (!job.active) return null;
    const sourceFingerprint = this.jobFingerprint(job);
    const existing = await this.dataSource.query(`SELECT * FROM job_match_profiles WHERE "jobId" = $1 LIMIT 1`, [job.id]);
    if (!force && existing[0]?.status === 'READY' && existing[0]?.sourceFingerprint === sourceFingerprint && existing[0]?.algorithmVersion === JOB_MATCH_ALGORITHM_VERSION) return existing[0];

    await this.dataSource.query(
      `INSERT INTO job_match_profiles ("jobId", status, "algorithmVersion", "sourceFingerprint", profile, error, "updatedAt")
       VALUES ($1, 'PENDING', $2, $3, NULL, NULL, now())
       ON CONFLICT ("jobId") DO UPDATE SET status = 'PENDING', "algorithmVersion" = EXCLUDED."algorithmVersion",
         "sourceFingerprint" = EXCLUDED."sourceFingerprint", error = NULL, "updatedAt" = now()`,
      [job.id, JOB_MATCH_ALGORITHM_VERSION, sourceFingerprint],
    );

    try {
      const profile = await this.ai.analyze(job);
      const rows = await this.dataSource.query(
        `UPDATE job_match_profiles SET status = 'READY', profile = $2::jsonb, error = NULL, "analyzedAt" = now(), "updatedAt" = now()
         WHERE "jobId" = $1 RETURNING *`,
        [job.id, JSON.stringify(profile)],
      );
      return rows[0] || null;
    } catch (error: any) {
      await this.dataSource.query(
        `UPDATE job_match_profiles SET status = 'ERROR', error = $2, "updatedAt" = now() WHERE "jobId" = $1`,
        [job.id, String(error?.message || 'Falha ao analisar vaga para matching').slice(0, 2000)],
      );
      console.error(`Job match profile error for ${job.id}:`, error);
      return null;
    }
  }

  async reanalyzeJob(jobId: string) {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    return this.analyzeActiveJob(job, true);
  }

  private candidateData(user: User) {
    const experiences = Array.isArray(user.experiences) ? user.experiences : [];
    const courses = Array.isArray(user.courses) ? user.courses : [];
    const education = Array.isArray(user.education) ? user.education : [];
    const roles = experiences.flatMap((experience: any) => [experience?.role, ...(Array.isArray(experience?.timeline) ? experience.timeline.map((stage: any) => stage?.role) : [])]).filter(Boolean).map(String);
    const skills = [
      ...(Array.isArray(user.skills) ? user.skills : []),
      ...experiences.flatMap((experience: any) => Array.isArray(experience?.skills) ? experience.skills : []),
      ...courses.flatMap((course: any) => Array.isArray(course?.skills) ? course.skills : []),
    ].filter(Boolean).map(String);
    const experienceText = experiences.flatMap((experience: any) => [experience?.role, experience?.description, experience?.company, ...(Array.isArray(experience?.timeline) ? experience.timeline.flatMap((stage: any) => [stage?.role, stage?.description]) : [])]).filter(Boolean).join(' ');
    const educationText = education.flatMap((item: any) => [item?.degree, item?.fieldOfStudy, item?.institution, item?.description]).filter(Boolean).join(' ');
    const courseText = courses.flatMap((item: any) => [item?.name, item?.institution, item?.description]).filter(Boolean).join(' ');
    const allText = [user.bio, roles.join(' '), skills.join(' '), experienceText, educationText, courseText].filter(Boolean).join(' ');
    return { roles, skills, experienceText, educationText, courseText, allText };
  }

  private phraseScore(term: string, source: string, ignoreGeneric = false) {
    const normalizedTerm = this.normalize(term);
    const normalizedSource = this.normalize(source);
    if (!normalizedTerm || !normalizedSource) return 0;
    if (normalizedSource.includes(normalizedTerm)) return 1;
    const wanted = this.tokens(term, ignoreGeneric);
    if (!wanted.length) return 0;
    const sourceTokens = new Set(this.tokens(source));
    const overlap = wanted.filter((token) => sourceTokens.has(token)).length;
    const coverage = overlap / wanted.length;
    if (coverage === 1) return 0.9;
    if (coverage >= 0.75 && overlap >= 2) return 0.72;
    if (coverage >= 0.5 && overlap >= 2) return 0.48;
    return 0;
  }

  private bestEvidence(terms: string[], sources: string[], ignoreGeneric = false) {
    let best = 0;
    for (const term of terms.filter(Boolean)) for (const source of sources.filter(Boolean)) best = Math.max(best, this.phraseScore(term, source, ignoreGeneric));
    return best;
  }

  private requirementScore(requirements: WeightedJobRequirement[], candidate: ReturnType<JobMatchService['candidateData']>, types: WeightedJobRequirement['type'][]) {
    const selected = requirements.filter((item) => types.includes(item.type));
    if (!selected.length) return { score: 100, evidence: [] as string[], missing: [] as WeightedJobRequirement[] };
    let weighted = 0;
    let weightTotal = 0;
    const evidence: string[] = [];
    const missing: WeightedJobRequirement[] = [];
    for (const item of selected) {
      const source = item.type === 'EDUCATION' ? `${candidate.educationText} ${candidate.courseText}` : item.type === 'EXPERIENCE' ? candidate.experienceText : candidate.allText;
      const match = this.bestEvidence([item.label, ...(item.evidenceTerms || [])], [source]);
      const covered = match >= 0.72;
      weighted += (covered ? 1 : match >= 0.48 ? 0.45 : 0) * item.weight;
      weightTotal += item.weight;
      if (covered) evidence.push(item.label);
      else if (item.required) missing.push(item);
    }
    return { score: weightTotal ? Math.round((weighted / weightTotal) * 100) : 100, evidence, missing };
  }

  private locationScore(job: Job, user: User) {
    if (this.normalize(job.workModel).includes('remot')) return 100;
    const preferences = (user.jobPreferences as any)?.preferredLocations;
    const accepted = [
      user.city && user.state ? `${user.city}|${user.state}` : '',
      ...(Array.isArray(preferences) ? preferences.map((item: any) => item?.city && item?.state ? `${item.city}|${item.state}` : '') : []),
    ].filter(Boolean).map((value) => this.normalize(value));
    if (!accepted.length || !job.city || !job.state) return 60;
    return accepted.includes(this.normalize(`${job.city}|${job.state}`)) ? 100 : 0;
  }

  private scoreJob(job: Job, profile: JobMatchProfile, user: User) {
    const candidate = this.candidateData(user);
    const occupationTerms = [profile.canonicalRole, profile.occupationalFamily, ...(profile.occupationKeywords || [])].filter(Boolean);
    const roleEvidence = this.bestEvidence(occupationTerms, candidate.roles, true);
    const broaderOccupationEvidence = this.bestEvidence(occupationTerms, [candidate.experienceText], true);

    let technicalWeighted = 0;
    let technicalWeight = 0;
    const evidence: string[] = [];
    const missingTechnical: string[] = [];
    for (const skill of profile.technicalSkills || []) {
      const match = this.bestEvidence([skill.name, ...(skill.evidenceTerms || [])], [...candidate.skills, candidate.experienceText]);
      const covered = match >= 0.72;
      technicalWeighted += (covered ? 1 : match >= 0.48 ? 0.4 : 0) * skill.weight;
      technicalWeight += skill.weight;
      if (covered) evidence.push(skill.name);
      else if (skill.required) missingTechnical.push(skill.name);
    }
    const technicalScore = technicalWeight ? Math.round((technicalWeighted / technicalWeight) * 100) : 0;

    let occupationalScore = 0;
    if (roleEvidence >= 0.9) occupationalScore = 100;
    else if (roleEvidence >= 0.72) occupationalScore = 82;
    else if (roleEvidence >= 0.48) occupationalScore = 55;
    else if (broaderOccupationEvidence >= 0.72) occupationalScore = 58;
    else if (technicalScore >= 65) occupationalScore = 48;
    else if (technicalScore >= 40) occupationalScore = 30;

    const experience = this.requirementScore(profile.requirements || [], candidate, ['EXPERIENCE']);
    const education = this.requirementScore(profile.requirements || [], candidate, ['EDUCATION','CERTIFICATION','LICENSE']);
    const other = this.requirementScore(profile.requirements || [], candidate, ['SKILL','OTHER']);
    const preferenceScore = this.locationScore(job, user);
    const effectiveTechnicalScore = Math.round(technicalScore * 0.82 + other.score * 0.18);

    let score = Math.round(occupationalScore * 0.35 + effectiveTechnicalScore * 0.30 + experience.score * 0.20 + education.score * 0.10 + preferenceScore * 0.05);
    const criticalMissing = [
      ...missingTechnical,
      ...experience.missing.map((item) => item.label),
      ...education.missing.filter((item) => item.type === 'CERTIFICATION' || item.type === 'LICENSE').map((item) => item.label),
      ...other.missing.map((item) => item.label),
    ];
    const missingRequirements = Array.from(new Set([...criticalMissing, ...education.missing.map((item) => item.label)])).slice(0, 8);

    if (occupationalScore < 20 && effectiveTechnicalScore < 20) score = Math.min(score, 20);
    if (criticalMissing.length >= 2) score = Math.min(score, 39);
    else if (criticalMissing.length === 1) score = Math.min(score, 49);
    if (preferenceScore === 0) score = Math.min(score, 79);
    score = Math.max(0, Math.min(100, score));

    const allEvidence = Array.from(new Set([...evidence, ...experience.evidence, ...education.evidence, ...other.evidence])).slice(0, 8);
    const reason = score >= 75
      ? 'O currículo apresenta aderência ocupacional e técnica consistente com os principais requisitos da vaga.'
      : score >= 55
        ? 'Há aderência relevante, mas ainda existem lacunas profissionais importantes para esta vaga.'
        : score >= 35
          ? 'A compatibilidade é parcial e depende de competências transferíveis; há requisitos centrais ainda não comprovados.'
          : 'O currículo não apresenta evidência suficiente de aderência ocupacional ou técnica para esta vaga.';

    return {
      score,
      occupationalScore,
      technicalScore: effectiveTechnicalScore,
      experienceScore: experience.score,
      educationScore: education.score,
      preferenceScore,
      confidence: candidate.roles.length + candidate.skills.length >= 4 ? 'HIGH' : candidate.roles.length > 0 ? 'MEDIUM' : 'LOW',
      evidence: allEvidence,
      missingRequirements,
      reason,
    };
  }

  private async cachedScoreForUserJob(user: User, job: Job, jobProfile: any, existing?: any) {
    const resumeFingerprint = this.resumeFingerprint(user);
    const cacheValid = existing && existing.resumeFingerprint === resumeFingerprint && existing.jobProfileFingerprint === jobProfile.sourceFingerprint && existing.algorithmVersion === JOB_MATCH_ALGORITHM_VERSION;
    if (cacheValid) return existing.result;

    const result = this.scoreJob(job, jobProfile.profile as JobMatchProfile, user);
    await this.dataSource.query(
      `INSERT INTO job_match_results ("userId", "jobId", "resumeFingerprint", "jobProfileFingerprint", "algorithmVersion", score, result, "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now())
       ON CONFLICT ("userId", "jobId") DO UPDATE SET
         "resumeFingerprint" = EXCLUDED."resumeFingerprint", "jobProfileFingerprint" = EXCLUDED."jobProfileFingerprint",
         "algorithmVersion" = EXCLUDED."algorithmVersion", score = EXCLUDED.score, result = EXCLUDED.result, "updatedAt" = now()`,
      [user.id, job.id, resumeFingerprint, jobProfile.sourceFingerprint, JOB_MATCH_ALGORITHM_VERSION, result.score, JSON.stringify(result)],
    );
    return result;
  }

  private rankCompanyExposure<T extends { score: number; boosted: boolean }>(eligible: T[]): T[] {
    const organic = eligible.filter((item) => !item.boosted).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const boosted = eligible.filter((item) => item.boosted).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const ranked: T[] = [];

    // O primeiro resultado orgânico permanece protegido. Depois disso, o impulso
    // compra exposição real: 1 slot de destaque, 2 orgânicos, 1 destaque, etc.
    if (organic.length > 0) ranked.push(organic.shift()!);
    while (organic.length > 0 || boosted.length > 0) {
      if (boosted.length > 0) ranked.push(boosted.shift()!);
      for (let i = 0; i < 2 && organic.length > 0; i += 1) ranked.push(organic.shift()!);
      if (organic.length === 0 && boosted.length > 0 && ranked.length > 0) {
        while (boosted.length > 0) ranked.push(boosted.shift()!);
      }
    }
    return ranked;
  }

  async getStatus(userId: string) {
    const [product, entitlementRows, lifetimeFree] = await Promise.all([
      this.payments.findProduct('JOB_MATCH_30D', true),
      this.dataSource.query(
        `SELECT "startsAt", "expiresAt", "paymentId", source, ("expiresAt" > now()) AS active
         FROM user_feature_entitlements
         WHERE "userId" = $1 AND feature = 'JOB_MATCH_PREMIUM' LIMIT 1`,
        [userId],
      ),
      this.billingSupport.isLifetimeFree(userId),
    ]);
    const entitlement = entitlementRows[0] || null;
    return { product, entitlement, lifetimeFree, active: lifetimeFree || Boolean(entitlement?.active) };
  }

  async getMatches(userId: string) {
    const status = await this.getStatus(userId);
    if (!status.active) return { ...status, matches: [] };
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Perfil do usuário não encontrado.');

    const jobs = await this.jobs.find({ where: { active: true }, order: { createdAt: 'DESC' } });
    if (!jobs.length) return { ...status, matches: [] };
    const jobIds = jobs.map((job) => job.id);
    const profiles = await this.dataSource.query(`SELECT * FROM job_match_profiles WHERE status = 'READY' AND "jobId" = ANY($1::uuid[])`, [jobIds]);
    const profileMap = new Map(profiles.map((row: any) => [row.jobId, row]));
    const cached = await this.dataSource.query(`SELECT * FROM job_match_results WHERE "userId" = $1 AND "jobId" = ANY($2::uuid[])`, [userId, jobIds]);
    const cacheMap = new Map(cached.map((row: any) => [row.jobId, row]));
    const matches: any[] = [];

    for (const job of jobs) {
      const jobProfile = profileMap.get(job.id) as any;
      if (!jobProfile?.profile) continue;
      const result = await this.cachedScoreForUserJob(user, job, jobProfile, cacheMap.get(job.id));
      matches.push({ jobId: job.id, ...result });
    }

    matches.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return { ...status, matches };
  }

  async getCompanyCandidatesForJob(requestingUserId: string, jobId: string) {
    const [requester, job] = await Promise.all([
      this.users.findOne({ where: { id: requestingUserId } }),
      this.jobs.findOne({ where: { id: jobId } }),
    ]);
    if (!requester) throw new ForbiddenException('Usuário não encontrado.');
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    const authorized = requester.type === UserType.ADMIN || job.ownerId === requestingUserId || Boolean(requester.companyId && job.companyId && requester.companyId === job.companyId);
    if (!authorized) throw new ForbiddenException('Você não pode consultar candidatos para esta vaga.');

    const profileRows = await this.dataSource.query(
      `SELECT * FROM job_match_profiles WHERE "jobId" = $1 AND status = 'READY' LIMIT 1`,
      [jobId],
    );
    const jobProfile = profileRows[0];
    if (!jobProfile?.profile) {
      return { jobId, preparing: true, candidates: [] };
    }

    const candidates = await this.users.createQueryBuilder('user')
      .where('user."resumeStatus" = :status', { status: 'PUBLISHED' })
      .andWhere('user."isOpenToWork" = true')
      .andWhere('(user.type IS NULL OR user.type = :candidateType)', { candidateType: UserType.CANDIDATE })
      .orderBy('user."updatedAt"', 'DESC')
      .take(500)
      .getMany();
    if (!candidates.length) return { jobId, preparing: false, candidates: [] };

    const candidateIds = candidates.map((candidate) => candidate.id);
    const [cachedRows, boostRows] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM job_match_results WHERE "jobId" = $1 AND "userId" = ANY($2::varchar[])`,
        [jobId, candidateIds],
      ),
      this.dataSource.query(
        `SELECT "userId" FROM user_feature_entitlements
         WHERE feature = 'RESUME_BOOST' AND "expiresAt" > now() AND "userId" = ANY($1::varchar[])`,
        [candidateIds],
      ),
    ]);
    const cacheMap = new Map(cachedRows.map((row: any) => [row.userId, row]));
    const boosts = new Set(boostRows.map((row: any) => row.userId));
    const eligible: Array<{ candidateId: string; score: number; boosted: boolean }> = [];

    for (const candidate of candidates) {
      const result = await this.cachedScoreForUserJob(candidate, job, jobProfile, cacheMap.get(candidate.id));
      if (Number(result.score || 0) < 55) continue;
      eligible.push({
        candidateId: candidate.id,
        score: Number(result.score || 0),
        boosted: boosts.has(candidate.id),
      });
    }

    const ranked = this.rankCompanyExposure(eligible);

    // A empresa recebe apenas a ordem final e a sinalização comercial. A nota de
    // compatibilidade continua privada, disponível somente ao próprio candidato.
    return {
      jobId,
      preparing: false,
      rankingRule: 'organic_top_then_sponsored_slots',
      candidates: ranked.map((item) => ({
        candidateId: item.candidateId,
        boosted: item.boosted,
      })),
    };
  }
}
