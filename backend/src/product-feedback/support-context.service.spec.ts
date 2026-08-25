import { SupportContextService } from './support-context.service';
import { User, UserType } from '../users/entities/user.entity';

describe('SupportContextService', () => {
  const dataSource = { query: jest.fn().mockResolvedValue([]) } as any;
  let service: SupportContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockResolvedValue([]);
    service = new SupportContextService(dataSource);
  });

  function user(input: Partial<User> = {}) {
    return {
      id: 'user-1',
      type: UserType.CANDIDATE,
      companyId: null,
      isCompanyAdmin: false,
      resumeStatus: 'DRAFT',
      resumePublishedAt: null,
      isOpenToWork: true,
      phone: '19999999999',
      city: 'Pirassununga',
      state: 'SP',
      ...input,
    } as User;
  }

  it('loads resume context for a candidate without leaking admin or company contexts', async () => {
    const bundle = await service.resolve(user(), {
      message: 'Como publico meu currículo e gero o PDF?',
      pagePath: '/user/curriculo',
      process: 'Currículo',
    });

    expect(bundle.contextIds).toContain('candidate.resume');
    expect(bundle.contextIds.some((id) => id.startsWith('admin.'))).toBe(false);
    expect(bundle.contextIds.some((id) => id.startsWith('company.'))).toBe(false);
    expect(bundle.restrictedRequest).toBe(false);
  });

  it('blocks a candidate forging an admin page path', async () => {
    const bundle = await service.resolve(user(), {
      message: 'Como configuro a IA global e vejo as chaves internas?',
      pagePath: '/admin/ai',
      process: 'Configuração de inteligência artificial',
    });

    expect(bundle.restrictedRequest).toBe(true);
    expect(bundle.contextIds.some((id) => id.startsWith('admin.'))).toBe(false);
    expect(bundle.knowledge).not.toContain('Central WhatsApp administrativa');
  });

  it('loads Minha Página for a company-linked account', async () => {
    dataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM companies')) {
        return [{ id: 'company-1', name: 'Empresa Teste', verificationStatus: 'VERIFIED' }];
      }
      if (sql.includes('FROM company_pages')) {
        return [{ status: 'DRAFT', revision: 2, templateKey: 'aurora' }];
      }
      return [];
    });

    const bundle = await service.resolve(user({ companyId: 'company-1', isCompanyAdmin: true }), {
      message: 'Como mudo o tema e publico Minha Página?',
      pagePath: '/company/pagina',
      process: 'Página da empresa',
    });

    expect(bundle.audience).toBe('COMPANY');
    expect(bundle.contextIds).toContain('company.page');
    expect(bundle.restrictedRequest).toBe(false);
    expect(bundle.liveFacts.company).toEqual(expect.objectContaining({ id: 'company-1' }));
    expect(bundle.liveFacts.companyPage).toEqual(expect.objectContaining({ status: 'DRAFT' }));
  });

  it('does not teach company operations to a candidate without company access', async () => {
    const bundle = await service.resolve(user(), {
      message: 'Quero publicar vaga e ver candidatos inscritos da empresa',
      pagePath: '/user',
      process: 'Área do candidato',
    });

    expect(bundle.restrictedRequest).toBe(true);
    expect(bundle.contextIds.some((id) => id.startsWith('company.'))).toBe(false);
  });

  it('loads administrative AI context only for an administrator', async () => {
    const bundle = await service.resolve(user({ type: UserType.ADMIN }), {
      message: 'Como troco o provedor de IA?',
      pagePath: '/admin/ai',
      process: 'Configuração de inteligência artificial',
    });

    expect(bundle.audience).toBe('ADMIN');
    expect(bundle.contextIds).toContain('admin.ai-api');
    expect(bundle.restrictedRequest).toBe(false);
    expect(bundle.contextIds.some((id) => id.startsWith('company.'))).toBe(false);
    expect(bundle.contextIds.some((id) => id.startsWith('candidate.'))).toBe(false);
  });

  it('updates context from the current route instead of being tied to the first screen', async () => {
    const first = await service.resolve(user(), {
      message: 'Como edito meu currículo?',
      pagePath: '/user/curriculo',
      process: 'Currículo',
    });
    const second = await service.resolve(user(), {
      message: 'Como publico um anúncio?',
      pagePath: '/user/classificados/novo',
      process: 'Classificados',
    });

    expect(first.contextIds).toContain('candidate.resume');
    expect(second.contextIds).toContain('candidate.classifieds');
  });
});
