import { TalentInviteEmailService } from './talent-invite-email.service';

describe('TalentInviteEmailService', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.TRANSACTIONAL_EMAIL_FROM;
  const originalSiteUrl = process.env.PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.TRANSACTIONAL_EMAIL_FROM = 'PiraNegócios <convites@piranegocios.com.br>';
    process.env.PUBLIC_SITE_URL = 'https://piranegocios.com.br/';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.RESEND_API_KEY = originalApiKey;
    process.env.TRANSACTIONAL_EMAIL_FROM = originalFrom;
    process.env.PUBLIC_SITE_URL = originalSiteUrl;
    jest.restoreAllMocks();
  });

  it('envia o convite com a identidade e o texto transacional atualizados', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'email-1' }),
    }) as any;
    const service = new TalentInviteEmailService();

    await expect(
      service.sendInvitation({
        to: 'candidato@example.com',
        candidateName: 'Alex',
        companyName: 'Empresa Teste',
        jobTitle: 'Pessoa Desenvolvedora',
        jobLocation: 'Pirassununga/SP',
        inviteUrl: 'https://piranegocios.com.br/convite/token',
        expiresAt: new Date('2026-08-31T12:00:00-03:00'),
      }),
    ).resolves.toEqual({ status: 'SENT', messageId: 'email-1' });

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    const body = JSON.parse(request.body);
    expect(body.subject).toBe(
      'Empresa Teste — convite para o processo seletivo de Pessoa Desenvolvedora',
    );
    expect(body.html).toContain('Convite especial');
    expect(body.html).toContain(
      'https://piranegocios.com.br/brand/symbol-white-textured.png',
    );
    expect(body.html).toContain(
      'https://piranegocios.com.br/brand/logo-horizontal-terracotta.png',
    );
    expect(body.html).toContain(
      'Olá, estamos te convidando a participar do processo seletivo para a vaga de:',
    );
    expect(body.html).toContain('Acesse o link abaixo e confira a vaga.');
    expect(body.html).toContain('background:#f5f5f4');
  });
});
