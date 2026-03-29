import { AuthRepository } from '../../auth/repositories/auth.repository';
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
  oAuthAccount: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

describe('AuthRepository', () => {
  let repo: AuthRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AuthRepository(mockPrisma as never);
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

    it('returns empty array when user has no accounts', async () => {
      mockPrisma.oAuthAccount.findMany.mockResolvedValue([]);

      const result = await repo.getOAuthAccounts('user-none');

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findOAuthAccount
  // ---------------------------------------------------------------------------

  describe('findOAuthAccount', () => {
    it('returns an oauth account by provider + providerId', async () => {
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(mockOAuthAccount);

      const result = await repo.findOAuthAccount(AuthProvider.GOOGLE, 'g-123');

      expect(result).toEqual(mockOAuthAccount);
      expect(mockPrisma.oAuthAccount.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerId: { provider: 'GOOGLE', providerId: 'g-123' },
        },
      });
    });

    it('returns null when account not found', async () => {
      mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);

      const result = await repo.findOAuthAccount(AuthProvider.GITHUB, 'nope');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // createOAuthAccount
  // ---------------------------------------------------------------------------

  describe('createOAuthAccount', () => {
    it('creates an oauth account with converted provider enum', async () => {
      mockPrisma.oAuthAccount.create.mockResolvedValue(mockOAuthAccount);

      const input = {
        provider: AuthProvider.GOOGLE,
        providerId: 'g-123',
        email: 'user@example.com',
        name: 'Test User',
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
  // updateOAuthAccount
  // ---------------------------------------------------------------------------

  describe('updateOAuthAccount', () => {
    it('updates oauth account fields', async () => {
      mockPrisma.oAuthAccount.updateMany.mockResolvedValue({ count: 1 });

      const updates = { accessToken: 'new-tok', email: 'new@example.com' };
      await repo.updateOAuthAccount(AuthProvider.GOOGLE, 'g-123', updates);

      expect(mockPrisma.oAuthAccount.updateMany).toHaveBeenCalledWith({
        where: { provider: 'GOOGLE', providerId: 'g-123' },
        data: { ...updates },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteOAuthAccount
  // ---------------------------------------------------------------------------

  describe('deleteOAuthAccount', () => {
    it('deletes oauth accounts by userId + provider', async () => {
      mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });

      await repo.deleteOAuthAccount('user-1', AuthProvider.GOOGLE);

      expect(mockPrisma.oAuthAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', provider: 'GOOGLE' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // countOAuthAccountsForUser
  // ---------------------------------------------------------------------------

  describe('countOAuthAccountsForUser', () => {
    it('returns the number of linked accounts', async () => {
      mockPrisma.oAuthAccount.count.mockResolvedValue(2);

      const result = await repo.countOAuthAccountsForUser('user-1');

      expect(result).toBe(2);
      expect(mockPrisma.oAuthAccount.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createRefreshToken
  // ---------------------------------------------------------------------------

  describe('createRefreshToken', () => {
    it('creates a refresh token record', async () => {
      mockPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken);

      const expiresAt = new Date('2025-01-01');
      const result = await repo.createRefreshToken(
        'user-1',
        'tok-abc',
        expiresAt,
      );

      expect(result).toEqual(mockRefreshToken);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', token: 'tok-abc', expiresAt },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findRefreshToken
  // ---------------------------------------------------------------------------

  describe('findRefreshToken', () => {
    it('returns a refresh token when found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);

      const result = await repo.findRefreshToken('tok-abc');

      expect(result).toEqual(mockRefreshToken);
      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: 'tok-abc' },
      });
    });

    it('returns null when token not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const result = await repo.findRefreshToken('bad-tok');

      expect(result).toBeNull();
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

    it('returns null when refresh token does not exist', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const result = await repo.findUserByRefreshToken('bad-tok');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteRefreshToken
  // ---------------------------------------------------------------------------

  describe('deleteRefreshToken', () => {
    it('deletes a single refresh token', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await repo.deleteRefreshToken('tok-abc');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'tok-abc' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteAllRefreshTokensForUser
  // ---------------------------------------------------------------------------

  describe('deleteAllRefreshTokensForUser', () => {
    it('deletes all tokens for a user', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await repo.deleteAllRefreshTokensForUser('user-1');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteExpiredRefreshTokens
  // ---------------------------------------------------------------------------

  describe('deleteExpiredRefreshTokens', () => {
    it('deletes expired tokens and returns count', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repo.deleteExpiredRefreshTokens();

      expect(result).toBe(5);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getUserWithOAuthAccounts
  // ---------------------------------------------------------------------------

  describe('getUserWithOAuthAccounts', () => {
    it('returns user with oauth accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.getUserWithOAuthAccounts('user-1');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { oauthAccounts: true },
      });
    });

    it('returns null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.getUserWithOAuthAccounts('missing');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // canUnlinkOAuthAccount
  // ---------------------------------------------------------------------------

  describe('canUnlinkOAuthAccount', () => {
    it('returns true when user has more than one linked account', async () => {
      mockPrisma.oAuthAccount.count.mockResolvedValue(2);

      const result = await repo.canUnlinkOAuthAccount(
        'user-1',
        AuthProvider.GOOGLE,
      );

      expect(result).toBe(true);
    });

    it('returns false when user has only one account', async () => {
      mockPrisma.oAuthAccount.count.mockResolvedValue(1);

      const result = await repo.canUnlinkOAuthAccount(
        'user-1',
        AuthProvider.GOOGLE,
      );

      expect(result).toBe(false);
    });
  });
});
