import { NotFoundException } from '@nestjs/common';
import { UserService } from '../user.service';
import type { UserPrismaService } from '../user-prisma.service';

describe('UserService', () => {
  const prismaMock = (): jest.Mocked<UserPrismaService> =>
    ({
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }) as unknown as jest.Mocked<UserPrismaService>;

  let prisma: jest.Mocked<UserPrismaService>;
  let service: UserService;

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    password: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = prismaMock();
    service = new UserService(prisma);
  });

  it('returns all users', async () => {
    prisma.user.findMany.mockResolvedValue([user]);

    await expect(service.findAll()).resolves.toEqual([user]);
  });

  it('returns a single user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(service.findOne('user-1')).resolves.toEqual(user);
  });

  it('throws NotFound when user is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });

  it('creates a new user', async () => {
    const dto = { email: 'a', password: 'b', name: 'c' } as any;
    prisma.user.create.mockResolvedValue({ ...user, ...dto });

    await expect(service.create(dto)).resolves.toEqual({ ...user, ...dto });
    expect(prisma.user.create).toHaveBeenCalledWith({ data: dto });
  });

  it('updates an existing user', async () => {
    const dto = { name: 'Updated' } as any;
    prisma.user.update.mockResolvedValue({ ...user, ...dto });

    await expect(service.update('user-1', dto)).resolves.toEqual({
      ...user,
      ...dto,
    });
  });

  it('translates Prisma P2025 errors to NotFoundException when updating', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2025' });

    await expect(service.update('missing', {} as any)).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });

  it('rethrows unexpected errors when updating', async () => {
    const unexpected = new Error('boom');
    prisma.user.update.mockRejectedValue(unexpected);

    await expect(service.update('user-1', {} as any)).rejects.toThrow(
      unexpected,
    );
  });

  it('removes a user', async () => {
    prisma.user.delete.mockResolvedValue(undefined as any);

    await expect(service.remove('user-1')).resolves.toEqual({
      message: 'User with ID user-1 has been deleted',
    });
  });

  it('translates Prisma P2025 errors to NotFoundException when removing', async () => {
    prisma.user.delete.mockRejectedValue({ code: 'P2025' });

    await expect(service.remove('missing')).rejects.toThrow(
      new NotFoundException('User with ID missing not found').message,
    );
  });

  it('rethrows unexpected errors when removing', async () => {
    const unexpected = new Error('boom');
    prisma.user.delete.mockRejectedValue(unexpected);

    await expect(service.remove('user-1')).rejects.toThrow(unexpected);
  });
});
