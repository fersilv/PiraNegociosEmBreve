import { JobMatchService } from './job-match.service';
import type { JobMatchProfile } from './job-match-ai.service';
import type { Job } from '../jobs/entities/job.entity';
import type { User } from '../users/entities/user.entity';

describe('JobMatchService scoring guardrails', () => {
  const service = new JobMatchService({} as any, {} as any, {} as any, {} as any, {} as any) as any;

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
});
