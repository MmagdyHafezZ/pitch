import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlatformRepository } from '../../platform/platform.repository';
import { LtiPrismaService } from '../../prisma/lti-prisma.service';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from '../mocks/lti-prisma.service.mock';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PlatformRepository', () => {
  let repository: PlatformRepository;
  let db: MockLtiPrismaService;

  const mockPlatform = {
    id: 'platform-1',
    name: 'Test LMS',
    consumerKey: 'key-123',
    consumerSecret: '$2b$10$hashedSecret',
    issuer: 'https://canvas.example.com',
    clientId: 'client-abc',
    authLoginUrl: 'https://canvas.example.com/api/lti/authorize_redirect',
    authTokenUrl: 'https://canvas.example.com/login/oauth2/token',
    keysetUrl: 'https://canvas.example.com/api/lti/security/jwks',
    redirectUris: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformRepository,
        { provide: LtiPrismaService, useValue: db },
      ],
    }).compile();

    repository = module.get<PlatformRepository>(PlatformRepository);

    (mockBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedSecret');
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('hashes consumerSecret and calls db.platform.create', async () => {
      db.platform.create.mockResolvedValue(mockPlatform);

      const dto = {
        name: 'Test LMS',
        consumerKey: 'key-123',
        consumerSecret: 'raw-secret',
      };

      const result = await repository.create(dto as any);

      expect(mockBcrypt.hash).toHaveBeenCalledWith('raw-secret', 10);
      expect(db.platform.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            consumerSecret: '$2b$10$hashedSecret',
          }),
        }),
      );
      expect(result).toEqual(mockPlatform);
    });

    it('skips hashing when consumerSecret is not provided', async () => {
      db.platform.create.mockResolvedValue({
        ...mockPlatform,
        consumerSecret: null,
      });

      await repository.create({ name: 'Test LMS' } as any);

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });

    it('defaults isActive to true and redirectUris to []', async () => {
      db.platform.create.mockResolvedValue(mockPlatform);

      await repository.create({ name: 'Test' } as any);

      expect(db.platform.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true, redirectUris: [] }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns only active platforms', async () => {
      db.platform.findMany.mockResolvedValue([mockPlatform]);

      const result = await repository.findAll();

      expect(db.platform.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toEqual([mockPlatform]);
    });
  });

  describe('findById', () => {
    it('returns the platform when found', async () => {
      db.platform.findUnique.mockResolvedValue(mockPlatform);

      const result = await repository.findById('platform-1');

      expect(db.platform.findUnique).toHaveBeenCalledWith({
        where: { id: 'platform-1' },
      });
      expect(result).toEqual(mockPlatform);
    });

    it('throws NotFoundException when not found', async () => {
      db.platform.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByConsumerKey', () => {
    it('returns platform for a valid consumer key', async () => {
      db.platform.findUnique.mockResolvedValue(mockPlatform);

      const result = await repository.findByConsumerKey('key-123');

      expect(db.platform.findUnique).toHaveBeenCalledWith({
        where: { consumerKey: 'key-123' },
      });
      expect(result).toEqual(mockPlatform);
    });

    it('throws NotFoundException for unknown consumer key', async () => {
      db.platform.findUnique.mockResolvedValue(null);

      await expect(repository.findByConsumerKey('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIssuerAndClientId', () => {
    it('returns platform for matching issuer + clientId', async () => {
      db.platform.findUnique.mockResolvedValue(mockPlatform);

      const result = await repository.findByIssuerAndClientId(
        'https://canvas.example.com',
        'client-abc',
      );

      expect(db.platform.findUnique).toHaveBeenCalledWith({
        where: {
          issuer_clientId: {
            issuer: 'https://canvas.example.com',
            clientId: 'client-abc',
          },
        },
      });
      expect(result).toEqual(mockPlatform);
    });

    it('throws NotFoundException when not found', async () => {
      db.platform.findUnique.mockResolvedValue(null);

      await expect(
        repository.findByIssuerAndClientId(
          'https://missing.example.com',
          'xyz',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('calls findById then updates', async () => {
      db.platform.findUnique.mockResolvedValue(mockPlatform);
      db.platform.update.mockResolvedValue({
        ...mockPlatform,
        name: 'Updated',
      });

      const result = await repository.update('platform-1', { name: 'Updated' });

      expect(db.platform.update).toHaveBeenCalledWith({
        where: { id: 'platform-1' },
        data: { name: 'Updated' },
      });
      expect(result.name).toBe('Updated');
    });

    it('throws when platform not found before update', async () => {
      db.platform.findUnique.mockResolvedValue(null);

      await expect(repository.update('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting isActive=false', async () => {
      db.platform.findUnique.mockResolvedValue(mockPlatform);
      db.platform.update.mockResolvedValue({
        ...mockPlatform,
        isActive: false,
      });

      await repository.remove('platform-1');

      expect(db.platform.update).toHaveBeenCalledWith({
        where: { id: 'platform-1' },
        data: { isActive: false },
      });
    });

    it('throws when platform not found before remove', async () => {
      db.platform.findUnique.mockResolvedValue(null);

      await expect(repository.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyConsumerSecret', () => {
    it('returns true when secret matches', async () => {
      db.platform.findUnique.mockResolvedValue(mockPlatform);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await repository.verifyConsumerSecret(
        'key-123',
        'raw-secret',
      );

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        'raw-secret',
        '$2b$10$hashedSecret',
      );
      expect(result).toBe(true);
    });

    it('returns false when platform has no consumerSecret', async () => {
      db.platform.findUnique.mockResolvedValue({
        ...mockPlatform,
        consumerSecret: null,
      });

      const result = await repository.verifyConsumerSecret(
        'key-123',
        'raw-secret',
      );

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('returns false when secret does not match', async () => {
      db.platform.findUnique.mockResolvedValue(mockPlatform);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await repository.verifyConsumerSecret(
        'key-123',
        'wrong-secret',
      );

      expect(result).toBe(false);
    });
  });
});
