import { BadRequestException } from '@nestjs/common';
import { ExternalApiClient } from './entities/external-api-client.entity';
import { ExternalJobsService } from './external-jobs.service';

describe('ExternalJobsService', () => {
  const client = {
    id: 'client-1',
    name: 'Agente de teste',
    sourceLabel: 'Grupo de vagas',
  } as ExternalApiClient;

  function setup() {
    const jobs = {
      findOne: jest.fn(),
      find: jest.fn(),
      exists: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const requests = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    return {
      jobs,
      requests,
      service: new ExternalJobsService(jobs as never, requests as never),
    };
  }

  it('rejeita valores não textuais e UF inválida sem gerar erro interno', async () => {
    const { service } = setup();
    await expect(
      service.findDuplicate(
        { title: { unsafe: true }, description: 'Descrição' },
        client,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.findDuplicate(
        { title: 'Vaga', description: 'Descrição', state: 'XX' },
        client,
      ),
    ).rejects.toThrow('state deve ser uma UF brasileira válida');
  });

  it('identifica duplicidade mesmo com acentos diferentes', async () => {
    const { service, jobs } = setup();
    jobs.findOne.mockResolvedValue(null);
    jobs.find.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Auxiliar de Producao',
        sourceName: 'Industria Exemplo',
        companyName: 'Industria Exemplo',
        city: 'Pirassununga',
        state: 'SP',
        location: 'Pirassununga, SP',
        active: true,
        moderationStatus: 'APPROVED',
        createdAt: new Date(),
      },
    ]);

    const result = await service.findDuplicate(
      {
        title: 'Auxiliar de Produção',
        sourceName: 'Indústria Exemplo',
        description: 'Atividades da vaga',
      },
      client,
    );

    expect(result.duplicate).toBe(true);
    expect(result.job?.id).toBe('job-1');
    expect(result.confidence).toBe(1);
  });

  it('cadastra a vaga inativa, pendente e vinculada à origem da chave', async () => {
    const { service, jobs, requests } = setup();
    jobs.findOne.mockResolvedValue(null);
    jobs.find.mockResolvedValue([]);
    jobs.exists.mockResolvedValue(false);
    jobs.save.mockImplementation(async (value) => ({
      ...value,
      id: 'job-new',
      createdAt: new Date(),
    }));

    const result = await service.create(
      {
        title: 'Repositor',
        description: 'Reposição de mercadorias',
        applicationWhatsApp: '(19) 99999-9999',
      },
      client,
    );

    expect(jobs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        moderationStatus: 'PENDING',
        ingestionSourceId: client.id,
        ingestionSourceName: client.name,
        applicationWhatsApp: '19999999999',
        city: 'Pirassununga',
        state: 'SP',
      }),
    );
    expect(requests.save).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        created: true,
        moderationStatus: 'PENDING',
      }),
    );
  });
});
