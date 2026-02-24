import { NotFoundException } from '@nestjs/common';
import { UserService } from '../../user/services/user.service';
import { UserRepository } from '../../user/repositories/user.repository';

describe('UserService', () => {
  let mockRepository: jest.Mocked<UserRepository>;
  let service: UserService;

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    avatar: null,
    settings: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeen: null,
  };

  beforeEach(() => {
    mockRepository = {
      findMany: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByOAuthAccount: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      touchLastSeen: jest.fn(),
      delete: jest.fn(),
      getOAuthAccounts: jest.fn(),
      createWithOAuth: jest.fn(),
      createOAuthAccount: jest.fn(),
      deleteOAuthAccount: jest.fn(),
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
      findUserByRefreshToken: jest.fn(),
      createRefreshToken: jest.fn(),
      deleteRefreshToken: jest.fn(),
      deleteExpiredRefreshTokens: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    service = new UserService(mockRepository);
  });

  it('returns all users', async () => {
    mockRepository.findMany.mockResolvedValue([user]);

    await expect(service.findAll()).resolves.toEqual([user]);
  });

  it('returns a single user by id', async () => {
    mockRepository.findById.mockResolvedValue(user);

    await expect(service.findOne('user-1')).resolves.toEqual(user);
  });

  it('normalizes non-object settings to null when reading a user', async () => {
    mockRepository.findById.mockResolvedValue({
      ...user,
      settings: 'unexpected' as any,
    });

    await expect(service.findOne('user-1')).resolves.toEqual({
      ...user,
      settings: null,
    });
  });

  it('throws NotFound when user is missing', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });

  it('creates a new user', async () => {
    const dto = { email: 'a', name: 'c', __claims: { id: 'x' } } as any;
    mockRepository.create.mockResolvedValue({ ...user, ...dto });

    await expect(service.create(dto)).resolves.toEqual({ ...user, ...dto });
    expect(mockRepository.create).toHaveBeenCalledWith({
      email: 'a',
      name: 'c',
    });
  });

  it('updates an existing user', async () => {
    const dto = {
      name: 'Updated',
      settings: { browser: { compactMode: true } },
      __claims: { id: 'x' },
    } as any;
    mockRepository.update.mockResolvedValue({ ...user, ...dto });

    await expect(service.update('user-1', dto)).resolves.toEqual({
      ...user,
      ...dto,
    });
    expect(mockRepository.update).toHaveBeenCalledWith('user-1', {
      name: 'Updated',
    });
  });

  it('translates Prisma P2025 errors to NotFoundException when updating', async () => {
    mockRepository.update.mockRejectedValue({ code: 'P2025' });

    await expect(service.update('missing', {} as any)).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });

  it('rethrows unexpected errors when updating', async () => {
    const unexpected = new Error('boom');
    mockRepository.update.mockRejectedValue(unexpected);

    await expect(service.update('user-1', {} as any)).rejects.toThrow(
      unexpected,
    );
  });

  it('removes a user', async () => {
    mockRepository.delete.mockResolvedValue(undefined as any);

    await expect(service.remove('user-1')).resolves.toEqual({
      message: 'User with ID user-1 has been deleted',
    });
  });

  it('translates Prisma P2025 errors to NotFoundException when removing', async () => {
    mockRepository.delete.mockRejectedValue({ code: 'P2025' });

    await expect(service.remove('missing')).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });

  it('rethrows unexpected errors when removing', async () => {
    const unexpected = new Error('boom');
    mockRepository.delete.mockRejectedValue(unexpected);

    await expect(service.remove('user-1')).rejects.toThrow(unexpected);
  });

  it('returns persisted settings for a user', async () => {
    const settings = { account: { timezone: '(GMT-5:00) Eastern Time' } };
    mockRepository.findById.mockResolvedValue(user);
    mockRepository.getSettings.mockResolvedValue(settings as any);

    await expect(service.getSettings('user-1')).resolves.toEqual(settings);
    expect(mockRepository.getSettings).toHaveBeenCalledWith('user-1');
  });

  it('returns empty settings object when no settings exist', async () => {
    mockRepository.findById.mockResolvedValue(user);
    mockRepository.getSettings.mockResolvedValue(null);

    await expect(service.getSettings('user-1')).resolves.toEqual({});
  });

  it('updates user settings', async () => {
    const settings = { browser: { compactMode: true } };
    mockRepository.updateSettings.mockResolvedValue(settings as any);

    await expect(
      service.updateSettings('user-1', settings as any),
    ).resolves.toEqual(settings);
    expect(mockRepository.updateSettings).toHaveBeenCalledWith(
      'user-1',
      settings,
    );
  });

  it('translates Prisma P2025 errors to NotFoundException when updating settings', async () => {
    mockRepository.updateSettings.mockRejectedValue({ code: 'P2025' });

    await expect(service.updateSettings('missing', {} as any)).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });

  it('touches last seen for an existing user', async () => {
    const touched = { ...user, lastSeen: new Date() };
    mockRepository.touchLastSeen.mockResolvedValue(touched as any);

    await expect(service.touchLastSeen('user-1')).resolves.toEqual(touched);
    expect(mockRepository.touchLastSeen).toHaveBeenCalledWith('user-1');
  });

  it('translates Prisma P2025 errors to NotFoundException when touching last seen', async () => {
    mockRepository.touchLastSeen.mockRejectedValue({ code: 'P2025' });

    await expect(service.touchLastSeen('missing')).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });
});
