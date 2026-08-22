import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExternalApiClient } from './entities/external-api-client.entity';
import { ExternalJobInput, ExternalJobsService } from './external-jobs.service';

describe('ExternalJobsService', () => {
  const client = {
    id: 'client-1',
    name: 'Agente de teste',
    sourceLabel: 'Grupo de vagas',
    keyHash: 'a'.repeat(64),
  } as ExternalApiClient;

  function setup() {
    const jobs = {
      findOne: jest.fn(),
      find: jest.fn(),
      exists: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
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

  it('valida e preserva o link explícito de candidatura online', async () => {
    const { service, jobs } = setup();
    jobs.findOne.mockResolvedValue(null);
    jobs.find.mockResolvedValue([]);

    const result = await service.findDuplicate(
      {
        title: 'Analista de suporte',
        description: 'Atendimento e suporte aos usuários.',
        applicationUrl: 'https://empresa.gupy.io/jobs/123',
        applicationUrlTitle: 'Candidatar-se pela Gupy',
      },
      client,
    );

    expect(result.data).toEqual(
      expect.objectContaining({
        applicationUrl: 'https://empresa.gupy.io/jobs/123',
        applicationUrlTitle: 'Candidatar-se pela Gupy',
      }),
    );

    await expect(
      service.findDuplicate(
        {
          title: 'Analista de suporte',
          description: 'Atendimento e suporte aos usuários.',
          applicationUrl: 'javascript:alert(1)',
        },
        client,
      ),
    ).rejects.toThrow('applicationUrl deve começar com http:// ou https://');
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
    expect(result.matchType).toBe('LIKELY');
  });

  it('lista todas as vagas com paginação por cursor, sem restringir às externas', async () => {
    const { service, jobs } = setup();
    const first = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Vaga de empresa',
      isExternalListing: false,
      createdAt: new Date('2026-08-18T12:00:00.000Z'),
      updatedAt: new Date('2026-08-18T12:00:00.000Z'),
    };
    const second = {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Vaga externa',
      isExternalListing: true,
      createdAt: new Date('2026-08-18T11:00:00.000Z'),
      updatedAt: new Date('2026-08-18T11:00:00.000Z'),
    };
    const builder = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([first, second]),
    };
    jobs.createQueryBuilder.mockReturnValue(builder);

    const result = await service.list({ limit: '1' }, client);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        title: 'Vaga de empresa',
        isExternalListing: false,
      }),
    );
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toEqual(expect.any(String));
    expect(builder.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('isExternalListing'),
      expect.anything(),
    );

    const nextBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([second]),
    };
    jobs.createQueryBuilder.mockReturnValue(nextBuilder);
    const nextPage = await service.list(
      { limit: '1', cursor: result.pagination.nextCursor || '' },
      client,
    );
    expect(nextBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('cursorCreatedAt'),
      expect.objectContaining({ cursorId: first.id }),
    );
    expect(nextPage.data[0]).toEqual(
      expect.objectContaining({ title: 'Vaga externa' }),
    );
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
        applicationUrl: 'https://empresa.example/carreiras/repositor',
        applicationUrlTitle: 'Candidatar-se no portal',
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
        applicationUrl: 'https://empresa.example/carreiras/repositor',
        applicationUrlTitle: 'Candidatar-se no portal',
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

  it('edita o conteúdo sem permitir alteração de status', async () => {
    const { service, jobs } = setup();
    const current = {
      id: 'job-api',
      ownerId: `api:${client.id}`,
      ingestionSourceId: client.id,
      ingestionSourceName: client.name,
      isExternalListing: true,
      title: 'Repositor',
      description: 'Descrição original da oportunidade',
      sourceName: 'Grupo de vagas',
      sourceUrl: null,
      city: 'Pirassununga',
      state: 'SP',
      type: 'CLT',
      workModel: 'Presencial',
      salary: null,
      requirements: null,
      applicationEmail: null,
      applicationWhatsApp: null,
      applicationUrl: null,
      applicationUrlTitle: null,
      externalApplicationInstructions: null,
      deadlineDate: null,
      active: false,
      moderationStatus: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jobs.findOne.mockResolvedValueOnce(current).mockResolvedValueOnce(current);
    jobs.save.mockImplementation(async (value) => value);

    const result = await service.update(
      current.id,
      { title: 'Repositor de loja', salary: 'R$ 2.500', applicationUrl: 'https://empresa.example/jobs/repositor' },
      client,
    );

    expect(result.updated).toBe(true);
    expect(result.job).toEqual(
      expect.objectContaining({
        title: 'Repositor de loja',
        salary: 'R$ 2.500',
        applicationUrl: 'https://empresa.example/jobs/repositor',
        active: false,
        moderationStatus: 'PENDING',
      }),
    );
    await expect(
      service.update(current.id, { active: true } as ExternalJobInput, client),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não permite que uma chave edite vaga criada por outra origem', async () => {
    const { service, jobs } = setup();
    jobs.findOne.mockResolvedValue({
      id: 'job-other',
      title: 'Vaga',
      description: 'Desc',
      sourceName: 'Source',
      city: 'City',
      state: 'ST',
      ownerId: 'api:other-client',
      ingestionSourceId: 'other-client',
      isExternalListing: true,
    });
    await expect(
      service.update(
        'job-other',
        { title: 'Tentativa', description: 'Descrição válida da vaga' },
        client,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
