import { UserRepository } from '../../user/repositories/user.repository';
import { AuthProvider } from '../../auth/factories/oauth-provider.factory';

const mockOAuthAccount = {
  id: 'oauth-1',
  provider: 'GOOGLE',
  providerId: 'g-123',
  email: 'user@example.com',
  name: 'Test User',
  avatar: null,
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  expiresAt: new Date('2025-01-01'),
  userId: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  avatar: null,
  isActive: true,
  lastSeen: null,
  settings: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  oauthAccounts: [mockOAuthAccount],
};

const mockRefreshToken = {
  id: 'rt-1',
  token: 'tok-abc',
  userId: 'user-1',
  expiresAt: new Date('2025-01-01'),
  createdAt: new Date('2024-01-01'),
};

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  oAuthAccount: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

describe('UserRepository', () => {
  let repo: UserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new UserRepository(mockPrisma as never, mockLogger as never);
  });

  // ---------------------------------------------------------------------------
  // findMany
  // ---------------------------------------------------------------------------

  describe('findMany', () => {
    it('returns all users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await repo.findMany();

      expect(result).toEqual([mockUser]);
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });

    it('returns empty array when no users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await repo.findMany();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns user with oauth accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { oauthAccounts: true },
      });
    });

    it('returns null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findById('missing');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findByEmail
  // ---------------------------------------------------------------------------

  describe('findByEmail', () => {
    it('returns user by email with oauth accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByEmail('user@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        include: { oauthAccounts: true },
      });
    });

    it('returns null when email not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findByOAuthAccount
  // ---------------------------------------------------------------------------

  describe('findByOAuthAccount', () => {
    it('finds user by provider + providerId', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await repo.findByOAuthAccount(
        AuthProvider.GOOGLE,
        'g-123',
      );

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          oauthAccounts: {
            some: { provider: 'GOOGLE', providerId: 'g-123' },
          },
        },
        include: { oauthAccounts: true },
      });
    });

    it('returns null when no matching account', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await repo.findByOAuthAccount(AuthProvider.GITHUB, 'nope');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a user with given data', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const input = { email: 'user@example.com', name: 'Test User' };
      const result = await repo.create(input);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: input,
        include: { oauthAccounts: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createWithOAuth
  // ---------------------------------------------------------------------------

  describe('createWithOAuth', () => {
    it('creates a user with nested oauth account', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const userData = { email: 'user@example.com', name: 'Test User' };
      const oauthData = {
        provider: AuthProvider.GOOGLE,
        providerId: 'g-123',
        email: 'user@example.com',
        accessToken: 'tok',
      };

      const result = await repo.createWithOAuth(userData, oauthData);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          ...userData,
          oauthAccounts: {
            create: { ...oauthData, provider: 'GOOGLE' },
          },
        },
        include: { oauthAccounts: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates user fields', async () => {
      const updated = { ...mockUser, name: 'Updated' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await repo.update('user-1', { name: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated' },
        include: { oauthAccounts: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // touchLastSeen
  // ---------------------------------------------------------------------------

  describe('touchLastSeen', () => {
    it('updates lastSeen with provided date', async () => {
      const at = new Date('2024-06-01');
      const updated = { ...mockUser, lastSeen: at };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await repo.touchLastSeen('user-1', at);

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastSeen: at },
        include: { oauthAccounts: true },
      });
    });

    it('defaults to current date when no date provided', async () => {
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await repo.touchLastSeen('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastSeen: expect.any(Date) },
        include: { oauthAccounts: true },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes user by id', async () => {
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      await repo.delete('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getOAuthAccounts
  // ---------------------------------------------------------------------------

  describe('getOAuthAccounts', () => {
    it('returns oauth accounts ordered by createdAt asc', async () => {
      mockPrisma.oAuthAccount.findMany.mockResolvedValue([mockOAuthAccount]);

      const result = await repo.getOAuthAccounts('user-1');

      expect(result).toEqual([mockOAuthAccount]);
      expect(mockPrisma.oAuthAccount.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createOAuthAccount
  // ---------------------------------------------------------------------------

  describe('createOAuthAccount', () => {
    it('creates an oauth account with mapped provider', async () => {
      mockPrisma.oAuthAccount.create.mockResolvedValue(mockOAuthAccount);

      const input = {
        provider: AuthProvider.GOOGLE,
        providerId: 'g-123',
        email: 'user@example.com',
        userId: 'user-1',
      };

      const result = await repo.createOAuthAccount(input);

      expect(result).toEqual(mockOAuthAccount);
      expect(mockPrisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: { ...input, provider: 'GOOGLE' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteOAuthAccount
  // ---------------------------------------------------------------------------

  describe('deleteOAuthAccount', () => {
    it('deletes oauth accounts for user + provider', async () => {
      mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });

      await repo.deleteOAuthAccount('user-1', AuthProvider.GOOGLE);

      expect(mockPrisma.oAuthAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', provider: 'GOOGLE' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findUserByRefreshToken
  // ---------------------------------------------------------------------------

  describe('findUserByRefreshToken', () => {
    it('returns user when refresh token exists', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...mockRefreshToken,
        user: mockUser,
      });

      const result = await repo.findUserByRefreshToken('tok-abc');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: 'tok-abc' },
        include: { user: { include: { oauthAccounts: true } } },
      });
    });

    it('returns null when refresh token not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const result = await repo.findUserByRefreshToken('bad-tok');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // createRefreshToken
  // ---------------------------------------------------------------------------

  describe('createRefreshToken', () => {
    it('creates a refresh token record', async () => {
      mockPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken);

      const expiresAt = new Date('2025-01-01');
      await repo.createRefreshToken('user-1', 'tok-abc', expiresAt);

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', token: 'tok-abc', expiresAt },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteRefreshToken
  // ---------------------------------------------------------------------------

  describe('deleteRefreshToken', () => {
    it('deletes a refresh token by value', async () => {
      mockPrisma.refreshToken.delete.mockResolvedValue(mockRefreshToken);

      await repo.deleteRefreshToken('tok-abc');

      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: 'tok-abc' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteExpiredRefreshTokens
  // ---------------------------------------------------------------------------

  describe('deleteExpiredRefreshTokens', () => {
    it('deletes tokens that have expired', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await repo.deleteExpiredRefreshTokens();

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getSettings
  // ---------------------------------------------------------------------------

  describe('getSettings', () => {
    it('returns parsed settings object', async () => {
      const settings = { theme: 'dark', lang: 'en' };
      mockPrisma.user.findUnique.mockResolvedValue({ settings });

      const result = await repo.getSettings('user-1');

      expect(result).toEqual(settings);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { settings: true },
      });
    });

    it('returns null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.getSettings('missing');

      expect(result).toBeNull();
    });

    it('returns null for non-object settings value', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ settings: 'invalid' });

      const result = await repo.getSettings('user-1');

      expect(result).toBeNull();
    });

    it('returns null for array settings value', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ settings: [1, 2] });

      const result = await repo.getSettings('user-1');

      expect(result).toBeNull();
    });

    it('returns null when settings is null', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ settings: null });

      const result = await repo.getSettings('user-1');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateSettings
  // ---------------------------------------------------------------------------

  describe('updateSettings', () => {
    it('persists and returns the updated settings', async () => {
      const settings = { theme: 'dark', lang: 'en' };
      mockPrisma.user.update.mockResolvedValue({ settings });

      const result = await repo.updateSettings('user-1', settings as any);

      expect(result).toEqual(settings);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { settings },
        select: { settings: true },
      });
    });

    it('returns empty object when stored settings is non-object', async () => {
      mockPrisma.user.update.mockResolvedValue({ settings: null });

      const result = await repo.updateSettings('user-1', {
        theme: 'light',
      } as any);

      expect(result).toEqual({});
    });
  });
});
