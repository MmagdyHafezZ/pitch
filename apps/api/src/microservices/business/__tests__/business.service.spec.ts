import { NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { BusinessService } from '../business.service';
import type { BusinessPrismaService } from '../business-prisma.service';
import { USER_SERVICE_PATTERNS } from '../../../common/interfaces/message-patterns.interface';

jest.mock('rxjs', () => ({
  firstValueFrom: jest.fn(),
}));

describe('BusinessService', () => {
  const prismaMock = (): jest.Mocked<BusinessPrismaService> =>
    ({
      business: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }) as unknown as jest.Mocked<BusinessPrismaService>;

  const clientMock = () =>
    ({
      send: jest.fn(),
    }) as unknown as jest.Mocked<ClientProxy>;

  let prisma: jest.Mocked<BusinessPrismaService>;
  let userService: jest.Mocked<ClientProxy>;
  let service: BusinessService;
  const mockFirstValueFrom = firstValueFrom as jest.MockedFunction<
    typeof firstValueFrom
  >;

  const business = {
    id: 'business-1',
    name: 'Acme Inc',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = prismaMock();
    userService = clientMock();
    service = new BusinessService(prisma, userService);
    mockFirstValueFrom.mockReset();
  });

  it('returns all businesses', async () => {
    prisma.business.findMany.mockResolvedValue([business]);

    await expect(service.findAll()).resolves.toEqual([business]);
    expect(prisma.business.findMany).toHaveBeenCalled();
  });

  it('returns a single business by id', async () => {
    prisma.business.findUnique.mockResolvedValue(business);

    await expect(service.findOne('business-1')).resolves.toEqual(business);
  });

  it('throws NotFound when business is missing', async () => {
    prisma.business.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(
      new NotFoundException('Business with ID missing not found').message,
    );
  });

  describe('findOneWithUser', () => {
    it('augments business with user information', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      mockFirstValueFrom.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        createdAt: 'now',
        updatedAt: 'later',
      });

      await expect(service.findOneWithUser('business-1')).resolves.toEqual({
        ...business,
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          createdAt: 'now',
          updatedAt: 'later',
        },
      });

      expect(userService.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_USER,
        { id: 'user-1' },
      );
    });

    it('returns business without user when lookup fails', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      mockFirstValueFrom.mockRejectedValue(new Error('network error'));

      await expect(service.findOneWithUser('business-1')).resolves.toEqual(
        business,
      );
    });
  });

  describe('create', () => {
    it('persists a business when user exists', async () => {
      const dto = { name: 'New Biz', userId: 'user-1' } as any;
      mockFirstValueFrom.mockResolvedValue({ id: 'user-1' });
      prisma.business.create.mockResolvedValue({ ...business, ...dto });

      await expect(service.create(dto)).resolves.toEqual({
        ...business,
        ...dto,
      });

      expect(userService.send).toHaveBeenCalledWith(
        USER_SERVICE_PATTERNS.GET_USER,
        { id: 'user-1' },
      );
      expect(prisma.business.create).toHaveBeenCalledWith({ data: dto });
    });

    it('throws NotFound when user service reports missing user', async () => {
      const dto = { name: 'New Biz', userId: 'missing' } as any;
      mockFirstValueFrom.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(dto)).rejects.toThrow(
        new NotFoundException('User with ID missing not found').message,
      );
    });

    it('rethrows unexpected errors from create', async () => {
      const dto = { name: 'New Biz', userId: 'user-1' } as any;
      const unexpected = new Error('database down');
      mockFirstValueFrom.mockRejectedValue(unexpected);

      await expect(service.create(dto)).rejects.toThrow(unexpected);
    });
  });

  describe('update', () => {
    it('updates an existing business', async () => {
      const dto = { name: 'Updated' } as any;
      prisma.business.update.mockResolvedValue({ ...business, ...dto });

      await expect(service.update('business-1', dto)).resolves.toEqual({
        ...business,
        ...dto,
      });
    });

    it('translates Prisma P2025 errors to NotFoundException', async () => {
      prisma.business.update.mockRejectedValue({ code: 'P2025' });

      await expect(service.update('missing', {} as any)).rejects.toThrow(
        new NotFoundException('Business with ID missing not found').message,
      );
    });

    it('rethrows unexpected errors from update', async () => {
      const unexpected = new Error('boom');
      prisma.business.update.mockRejectedValue(unexpected);

      await expect(service.update('biz-1', {} as any)).rejects.toThrow(
        unexpected,
      );
    });
  });

  describe('remove', () => {
    it('removes a business', async () => {
      prisma.business.delete.mockResolvedValue(undefined as any);

      await expect(service.remove('business-1')).resolves.toEqual({
        message: 'Business with ID business-1 has been deleted',
      });
    });

    it('throws NotFound when delete fails with P2025', async () => {
      prisma.business.delete.mockRejectedValue({ code: 'P2025' });

      await expect(service.remove('missing')).rejects.toThrow(
        new NotFoundException('Business with ID missing not found').message,
      );
    });

    it('rethrows unexpected errors from remove', async () => {
      const unexpected = new Error('boom');
      prisma.business.delete.mockRejectedValue(unexpected);

      await expect(service.remove('biz-1')).rejects.toThrow(unexpected);
    });
  });
});
