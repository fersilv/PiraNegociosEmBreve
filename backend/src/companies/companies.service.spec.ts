import { Company, CompanyStatus } from './entities/company.entity';
import { CompaniesService } from './companies.service';

describe('CompaniesService URL governance', () => {
  const baseCompany = (): Company =>
    ({
      id: 'company-1',
      ownerId: 'owner-1',
      name: 'Empresa Teste',
      slug: 'empresa-teste',
      slugIsCustom: false,
      pendingSlug: null,
      slugChangeStatus: 'NONE',
      slugChangeRequestedAt: null,
      slugChangeRequestedById: null,
      slugChangeReviewedAt: null,
      slugChangeReviewedById: null,
      slugChangeReviewNote: null,
      verificationStatus: CompanyStatus.VERIFIED,
      isVerified: true,
    }) as Company;

  function setup() {
    const companies = {
      findOne: jest.fn(),
      find: jest.fn(),
      exists: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      createQueryBuilder: jest.fn(),
    };
    const aliases = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    return {
      companies,
      aliases,
      service: new CompaniesService(companies as never, aliases as never),
    };
  }

  it('aplica a primeira URL personalizada e preserva a anterior por 90 dias', async () => {
    const { service, companies, aliases } = setup();
    const company = baseCompany();
    companies.findOne
      .mockResolvedValueOnce(company)
      .mockResolvedValueOnce(null);
    aliases.findOne.mockResolvedValue(null);

    const result = await service.requestSlugChange(
      'owner-1',
      company.id,
      'Minha Empresa',
    );

    expect(result.slug).toBe('minha-empresa');
    expect(result.slugIsCustom).toBe(true);
    expect(result.slugChangeStatus).toBe('APPROVED');
    expect(aliases.save).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'empresa-teste',
        replacedBySlug: 'minha-empresa',
        rollbackAvailable: true,
      }),
    );
    const savedAlias = aliases.save.mock.calls[0][0];
    expect(savedAlias.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 89 * 24 * 60 * 60 * 1000,
    );
  });

  it('mantém a URL atual e envia alterações posteriores para aprovação', async () => {
    const { service, companies, aliases } = setup();
    const company = { ...baseCompany(), slugIsCustom: true };
    companies.findOne
      .mockResolvedValueOnce(company)
      .mockResolvedValueOnce(null);
    aliases.findOne.mockResolvedValue(null);

    const result = await service.requestSlugChange(
      'owner-1',
      company.id,
      'Novo Endereço',
    );

    expect(result.slug).toBe('empresa-teste');
    expect(result.pendingSlug).toBe('novo-endereco');
    expect(result.slugChangeStatus).toBe('PENDING');
    expect(aliases.save).not.toHaveBeenCalled();
  });

  it('permite voltar uma vez e libera imediatamente a URL substituída', async () => {
    const { service, companies, aliases } = setup();
    const company = {
      ...baseCompany(),
      slug: 'url-nova',
      slugIsCustom: true,
    };
    const alias = {
      slug: 'url-antiga',
      replacedBySlug: 'url-nova',
      rollbackAvailable: true,
      rollbackUsed: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    companies.findOne.mockResolvedValue(company);
    aliases.findOne.mockResolvedValue(alias);

    const result = await service.rollbackSlugChange('owner-1', company.id);

    expect(result.slug).toBe('url-antiga');
    expect(result.slugChangeStatus).toBe('ROLLED_BACK');
    expect(alias.rollbackUsed).toBe(true);
    expect(alias.rollbackAvailable).toBe(false);
    expect(alias.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
