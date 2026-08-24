import { JobMatchService } from './job-match.service';
import type { JobMatchProfile } from './job-match-ai.service';
import type { Job } from '../jobs/entities/job.entity';
import { UserType, type User } from '../users/entities/user.entity';

describe('JobMatchService scoring guardrails', () => {
  const service = new JobMatchService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any) as any;

  const colhedoraJob = {
    id: 'job-1',
    title: 'Operador de Colhedora',
    city: 'Pirassununga',
    state: 'SP',
    workModel: 'Presencial',
  } as Job;

  const colhedoraProfile: JobMatchProfile = {
    canonicalRole: 'Operador de Colhedora',
    occupationalFamily: 'Operação de máquinas agrícolas e colheita mecanizada',
    occupationKeywords: ['colhedora', 'máquinas agrícolas', 'colheita mecanizada'],
    technicalSkills: [
      { name: 'Operação de colhedora', required: true, weight: 2, evidenceTerms: ['colhedora', 'máquina de colheita'] },
      { name: 'Máquinas agrícolas', required: true, weight: 1, evidenceTerms: ['máquinas agrícolas'] },
    ],
    requirements: [
      { label: 'Experiência com operação de colhedora', type: 'EXPERIENCE', required: true, weight: 2, evidenceTerms: ['operação de colhedora', 'colheita mecanizada'] },
    ],
    softSkills: ['Trabalho em equipe'],
    summary: 'Operação segura de colhedoras e máquinas agrícolas.',
  };

  it('não trata Operador de Caixa como compatibilidade média com Operador de Colhedora', () => {
    const candidate = {
      city: 'Pirassununga',
      state: 'SP',
      bio: 'Experiência em atendimento ao cliente e rotinas de caixa.',
      skills: ['Atendimento ao cliente', 'Operação de caixa', 'Recebimento de pagamentos'],
      experiences: [{ role: 'Operador de Caixa', company: 'Mercado', description: 'Abertura e fechamento de caixa, atendimento e recebimento.' }],
      education: [],
      courses: [],
      languages: [],
      jobPreferences: { preferredLocations: [{ city: 'Pirassununga', state: 'SP' }] },
    } as unknown as User;

    const result = service.scoreJob(colhedoraJob, colhedoraProfile, candidate);
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.occupationalScore).toBeLessThan(20);
    expect(result.missingRequirements).toContain('Operação de colhedora');
  });

  it('reconhece evidência específica de máquinas agrícolas sem depender da palavra Operador', () => {
    const candidate = {
      city: 'Pirassununga',
      state: 'SP',
      bio: 'Atuação com colheita mecanizada e máquinas agrícolas.',
      skills: ['Operação de colhedora', 'Máquinas agrícolas'],
      experiences: [{ role: 'Tratorista agrícola', company: 'Fazenda', description: 'Operação de colhedora, tratores e apoio à colheita mecanizada.' }],
      education: [],
      courses: [],
      languages: [],
      jobPreferences: { preferredLocations: [{ city: 'Pirassununga', state: 'SP' }] },
    } as unknown as User;

    const result = service.scoreJob(colhedoraJob, colhedoraProfile, candidate);
    expect(result.score).toBeGreaterThan(50);
    expect(result.technicalScore).toBeGreaterThanOrEqual(70);
  });

  it('coloca currículo impulsionado em slot superior sem adulterar a compatibilidade', () => {
    const entries = [
      { candidateId: 'ana', score: 84, boosted: false },
      { candidateId: 'maria', score: 76, boosted: false },
      { candidateId: 'luana', score: 66, boosted: false },
      { candidateId: 'joao', score: 59, boosted: true },
    ];

    const ranked = service.rankCompanyExposure(entries);

    expect(ranked.map((item: any) => item.candidateId)).toEqual(['ana', 'joao', 'maria', 'luana']);
    expect(ranked.find((item: any) => item.candidateId === 'joao')?.score).toBe(59);
    expect(ranked.find((item: any) => item.candidateId === 'maria')?.score).toBe(76);
  });

  it('usa um alias SQL seguro ao buscar candidatos para a vaga', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const jobs = {
      findOne: jest.fn().mockResolvedValue({ id: 'job-1', ownerId: 'owner-1', companyId: 'company-1' }),
    };
    const users = {
      findOne: jest.fn().mockResolvedValue({ id: 'owner-1', type: 'COMPANY', companyId: 'company-1' }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ profile: {} }]),
    };
    const queryService = new JobMatchService(jobs as any, users as any, dataSource as any, {} as any, {} as any, {} as any);

    await expect(queryService.getCompanyCandidatesForJob('owner-1', 'job-1')).resolves.toEqual({
      jobId: 'job-1',
      preparing: false,
      candidates: [],
    });
    expect(users.createQueryBuilder).toHaveBeenCalledWith('candidate');
    expect(queryBuilder.where).toHaveBeenCalledWith('candidate."resumeStatus" = :status', { status: 'PUBLISHED' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('candidate."isOpenToWork" = true');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('(candidate."type" IS NULL OR candidate."type" = :candidateType)', { candidateType: UserType.CANDIDATE });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('candidate."updatedAt"', 'DESC');
  });
});
