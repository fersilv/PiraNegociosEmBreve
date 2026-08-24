import { CandidatesController } from './candidates.controller';
import { UserType } from './entities/user.entity';

describe('CandidatesController', () => {
  it('localiza um perfil disponível somente por correspondência exata de e-mail', async () => {
    const candidate = {
      id: 'candidate-1',
      email: 'pessoa@example.com',
      type: UserType.CANDIDATE,
      isOpenToWork: true,
      fullName: 'Pessoa Candidata',
      socialName: null,
      displayName: null,
      resumeStatus: 'PUBLISHED',
      resumeURL: 'https://example.com/resume.pdf',
      publishedResumeSnapshot: { sections: [] },
      uploadedResumeFile: 'conteudo-privado',
      aiAnalysis: { score: 80 },
      jobPreferences: {
        preferredLocations: [{ city: 'Pirassununga', state: 'SP' }],
        pcdDeclaration: 'YES',
        pcdDocumentationStatus: 'AVAILABLE',
      },
    };
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(candidate),
    };
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'manager-1',
        companyId: 'company-1',
        type: UserType.COMPANY,
      }),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const companies = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'company-1', isVerified: true }),
    };
    const settings = {
      getValue: jest.fn().mockResolvedValue('true'),
    };
    const controller = new CandidatesController(
      users as never,
      companies as never,
      settings as never,
    );

    const result = await controller.findByEmail(
      { user: { uid: 'manager-1' } },
      ' Pessoa@Example.com ',
    );

    expect(users.createQueryBuilder).toHaveBeenCalledWith('candidate');
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'LOWER(candidate."email") = :email',
      { email: 'pessoa@example.com' },
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'candidate-1',
        name: 'Pessoa Candidata',
        email: 'pessoa@example.com',
        aiAnalysis: { score: 80 },
      }),
    );
    expect(result).not.toHaveProperty('uploadedResumeFile');
    expect(result?.jobPreferences).not.toHaveProperty('pcdDeclaration');
    expect(result?.jobPreferences).not.toHaveProperty('pcdDocumentationStatus');
  });
});
