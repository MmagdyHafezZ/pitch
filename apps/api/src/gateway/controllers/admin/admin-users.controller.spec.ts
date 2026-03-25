import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError, firstValueFrom, TimeoutError } from 'rxjs';
import { AdminUsersController } from './admin-users.controller';
import { AdminImpersonationService } from '../../services/admin/admin-impersonation.service';
import { CheckSystemAdmin } from '../../guards/check-system-admin.guard';
import { JwtService } from '@nestjs/jwt';

function makeClientProxy(sendResult: unknown = { status: 'ok' }) {
  return {
    send: jest.fn().mockReturnValue(of(sendResult)),
  };
}

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let userService: ReturnType<typeof makeClientProxy>;
  let simulationService: ReturnType<typeof makeClientProxy>;
  let impersonationService: AdminImpersonationService;

  beforeEach(async () => {
    userService = makeClientProxy();
    simulationService = makeClientProxy();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        CheckSystemAdmin,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ email: 'admin@test.com' }),
            sign: jest.fn().mockReturnValue('mock-token'),
          },
        },
        {
          provide: AdminImpersonationService,
          useValue: {
            impersonate: jest.fn().mockReturnValue({
              token: 'mock-token',
              expiresAt: '2099-01-01T00:00:00.000Z',
            }),
          },
        },
        { provide: 'USER_SERVICE', useValue: userService },
        { provide: 'SIMULATION_SERVICE', useValue: simulationService },
      ],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
    impersonationService = module.get<AdminImpersonationService>(
      AdminImpersonationService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listUsers()', () => {
    it('sends GET_USERS with default limit/offset when none provided', async () => {
      const users = [{ id: 'u1' }, { id: 'u2' }];
      userService.send.mockReturnValue(of(users));

      const result = await firstValueFrom(controller.listUsers());

      expect(userService.send).toHaveBeenCalledWith('get_users', {
        limit: 50,
        offset: 0,
        search: undefined,
        isAdmin: true,
      });
      expect(result).toEqual(users);
    });

    it('parses limit and offset from strings', async () => {
      userService.send.mockReturnValue(of([]));

      await firstValueFrom(controller.listUsers('10', '20', 'john'));

      expect(userService.send).toHaveBeenCalledWith('get_users', {
        limit: 10,
        offset: 20,
        search: 'john',
        isAdmin: true,
      });
    });

    it('throws HttpException on service error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'DB down', status: 503 })),
      );

      await expect(firstValueFrom(controller.listUsers())).rejects.toThrow(
        HttpException,
      );
    });

    it('uses default error message when error has no message', async () => {
      userService.send.mockReturnValue(throwError(() => ({})));

      try {
        await firstValueFrom(controller.listUsers());
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).message).toBe('Failed to list users');
      }
    });
  });

  describe('getUser()', () => {
    it('sends GET_USER with userId and isAdmin flag', async () => {
      const user = { id: 'u1', name: 'John' };
      userService.send.mockReturnValue(of(user));

      const result = await firstValueFrom(controller.getUser('u1'));

      expect(userService.send).toHaveBeenCalledWith('get_user', {
        userId: 'u1',
        isAdmin: true,
      });
      expect(result).toEqual(user);
    });

    it('throws HttpException when user not found', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Not found', status: 404 })),
      );

      try {
        await firstValueFrom(controller.getUser('bad-id'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(404);
      }
    });

    it('defaults to 500 when error has no status', async () => {
      userService.send.mockReturnValue(
        throwError(() => new Error('unexpected')),
      );

      try {
        await firstValueFrom(controller.getUser('u1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  });

  describe('updateUser()', () => {
    it('sends UPDATE_USER with userId, body, and isAdmin', async () => {
      const updated = { id: 'u1', name: 'Updated' };
      userService.send.mockReturnValue(of(updated));

      const body = { name: 'Updated' };
      const result = await firstValueFrom(controller.updateUser('u1', body));

      expect(userService.send).toHaveBeenCalledWith('update_user', {
        userId: 'u1',
        name: 'Updated',
        isAdmin: true,
      });
      expect(result).toEqual(updated);
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Validation failed', status: 400 })),
      );

      try {
        await firstValueFrom(controller.updateUser('u1', { name: '' }));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(400);
        expect((err as HttpException).message).toBe('Validation failed');
      }
    });
  });

  describe('deleteUser()', () => {
    it('sends DELETE_USER with userId and isAdmin', async () => {
      userService.send.mockReturnValue(of({ deleted: true }));

      const result = await firstValueFrom(controller.deleteUser('u1'));

      expect(userService.send).toHaveBeenCalledWith('delete_user', {
        userId: 'u1',
        isAdmin: true,
      });
      expect(result).toEqual({ deleted: true });
    });

    it('throws HttpException on error', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'Forbidden', status: 403 })),
      );

      await expect(firstValueFrom(controller.deleteUser('u1'))).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getUserSessions()', () => {
    it('sends LIST_SESSIONS to simulationService with defaults', async () => {
      const sessions = { sessions: [], total: 0 };
      simulationService.send.mockReturnValue(of(sessions));

      const result = await firstValueFrom(controller.getUserSessions('u1'));

      expect(simulationService.send).toHaveBeenCalledWith(
        'simulation.session.list',
        {
          userId: 'u1',
          limit: 50,
          offset: 0,
        },
      );
      expect(result).toEqual(sessions);
    });

    it('parses limit and offset from strings', async () => {
      simulationService.send.mockReturnValue(of({ sessions: [], total: 0 }));

      await firstValueFrom(controller.getUserSessions('u1', '25', '10'));

      expect(simulationService.send).toHaveBeenCalledWith(
        'simulation.session.list',
        {
          userId: 'u1',
          limit: 25,
          offset: 10,
        },
      );
    });

    it('throws HttpException on error', async () => {
      simulationService.send.mockReturnValue(
        throwError(() => ({ message: 'Service unavailable', status: 503 })),
      );

      try {
        await firstValueFrom(controller.getUserSessions('u1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).message).toBe('Service unavailable');
      }
    });
  });

  describe('impersonateUser()', () => {
    it('fetches user then calls impersonationService', async () => {
      const user = { id: 'u1', email: 'user@test.com', name: 'John' };
      userService.send.mockReturnValue(of(user));

      const req = { user: { email: 'admin@test.com' } };
      const result = await controller.impersonateUser('u1', req);

      expect(userService.send).toHaveBeenCalledWith('get_user', {
        userId: 'u1',
        isAdmin: true,
      });
      expect(impersonationService.impersonate).toHaveBeenCalledWith(
        { id: 'u1', email: 'user@test.com', name: 'John' },
        'admin@test.com',
      );
      expect(result).toEqual({
        token: 'mock-token',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
    });

    it('uses "unknown" when req.user.email is absent', async () => {
      const user = { id: 'u1', email: 'user@test.com', name: 'John' };
      userService.send.mockReturnValue(of(user));

      await controller.impersonateUser('u1', {});

      expect(impersonationService.impersonate).toHaveBeenCalledWith(
        expect.anything(),
        'unknown',
      );
    });

    it('throws HttpException when user lookup fails', async () => {
      userService.send.mockReturnValue(
        throwError(() => ({ message: 'User not found', status: 404 })),
      );

      await expect(
        controller.impersonateUser('bad-id', {
          user: { email: 'admin@test.com' },
        }),
      ).rejects.toThrow(HttpException);
    });
  });
});
