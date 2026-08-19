jest.mock('../auth/auth.guard', () => ({ FirebaseAuthGuard: class FirebaseAuthGuard {} }));

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserType } from './entities/user.entity';

describe('UsersController authorization boundary', () => {
  const usersService = {
    findOne: jest.fn(),
    findOneOrNull: jest.fn(),
    sanitizeSelfUpdate: jest.fn(),
    createOrUpdate: jest.fn(),
  } as unknown as UsersService;
  const configService = { get: jest.fn(() => '') } as unknown as ConfigService;
  const analyticsService = { recordAccountAccess: jest.fn() } as unknown as any;
  const controller = new UsersController(usersService, configService, analyticsService);
  const request = { user: { uid: 'candidate-1', email: 'candidate@example.com' } };

  beforeEach(() => jest.clearAllMocks());

  it('rejects client-controlled administrator and company permissions', async () => {
    (usersService.findOneOrNull as jest.Mock).mockResolvedValue({ id: 'candidate-1', type: UserType.CANDIDATE });
    (usersService.sanitizeSelfUpdate as jest.Mock).mockReturnValue({});

    await expect(controller.updateProfile(request, { type: UserType.ADMIN })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.updateProfile(request, { companyId: 'another-company' })).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.createOrUpdate).not.toHaveBeenCalled();
  });

  it('preserves a legitimate self-managed profile update', async () => {
    (usersService.findOneOrNull as jest.Mock).mockResolvedValue({ id: 'candidate-1', type: UserType.CANDIDATE });
    (usersService.sanitizeSelfUpdate as jest.Mock).mockReturnValue({ displayName: 'Ana' });
    (usersService.createOrUpdate as jest.Mock).mockResolvedValue({ id: 'candidate-1', displayName: 'Ana' });

    await expect(controller.updateProfile(request, { displayName: 'Ana' })).resolves.toEqual({ id: 'candidate-1', displayName: 'Ana' });
    expect(usersService.createOrUpdate).toHaveBeenCalledWith('candidate-1', {
      displayName: 'Ana',
      email: 'candidate@example.com',
    });
  });
});
