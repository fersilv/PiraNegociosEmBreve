import { ForbiddenException } from '@nestjs/common';
import { TalentInvitesService } from './talent-invites.service';

describe('TalentInvitesService', () => {
  const token = 'a'.repeat(43);
  const invite = () => ({
    id: 'invite-1',
    companyId: 'company-1',
    candidateId: null,
    candidateEmail: 'pessoa@example.com',
    candidateName: 'Pessoa',
    jobId: 'job-1',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 60_000),
    viewedAt: null,
    registeredAt: null,
  });
  const job = {
    id: 'job-1',
    companyId: 'company-1',
    title: 'Analista de operações',
    description: 'Descrição privada que não pode vazar antes do cadastro.',
    requirements: 'Requisitos privados',
    skills: ['Excel'],
    active: true,
    deadlineDate: null,
    isInternal: true,
  };
  const company = { id: 'company-1', name: 'Empresa Exemplo', logoURL: null };

  function setup() {
    const invites = {
      findOne: jest.fn().mockResolvedValue(invite()),
      find: jest.fn(),
      save: jest.fn(async (value) => value),
      create: jest.fn((value) => value),
      createQueryBuilder: jest.fn(),
    };
    const jobs = { findOne: jest.fn().mockResolvedValue(job), findBy: jest.fn() };
    const users = { findOne: jest.fn(), findBy: jest.fn(), createQueryBuilder: jest.fn() };
    const companies = { findOne: jest.fn().mockResolvedValue(company) };
    const applications = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const email = { sendInvitation: jest.fn() };
    const notifications = { notifyUser: jest.fn() };
    return {
      invites,
      users,
      service: new TalentInvitesService(
        invites as never,
        jobs as never,
        users as never,
        companies as never,
        applications as never,
        email as never,
        notifications as never,
      ),
    };
  }

  it('não revela a descrição da vaga antes de o cadastro ser validado', async () => {
    const { service, invites } = setup();

    const result = await service.preview(token);

    expect(result.job).toEqual({
      title: job.title,
      isInternal: true,
    });
    expect(result.job).not.toHaveProperty('description');
    expect(result.job).not.toHaveProperty('id');
    expect(invites.save).not.toHaveBeenCalled();
  });

  it('impede que uma conta de outro e-mail reivindique o convite', async () => {
    const { service } = setup();

    await expect(
      service.claim(token, {
        uid: 'user-2',
        email: 'outra-pessoa@example.com',
        emailVerified: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registra a visualização somente depois de a conta estar vinculada', async () => {
    const { service, invites } = setup();
    invites.findOne.mockResolvedValue({ ...invite(), candidateId: 'user-1' });

    const result = await service.markViewed('invite-1', 'user-1');

    expect(result.viewedAt).toBeInstanceOf(Date);
    expect(invites.save).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: 'user-1', viewedAt: expect.any(Date) }),
    );
  });
});
