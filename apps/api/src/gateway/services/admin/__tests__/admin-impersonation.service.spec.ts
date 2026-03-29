import { JwtService } from '@nestjs/jwt';
import { AdminImpersonationService } from '../admin-impersonation.service';

const makeJwtService = (): jest.Mocked<JwtService> =>
  ({
    sign: jest.fn().mockReturnValue('signed-token'),
  }) as unknown as jest.Mocked<JwtService>;

describe('AdminImpersonationService', () => {
  it('returns a token and expiresAt string', () => {
    const jwtService = makeJwtService();
    const service = new AdminImpersonationService(jwtService);

    const result = service.impersonate(
      { id: 'user-1', email: 'user@example.com', name: 'Alice' },
      'admin@example.com',
    );

    expect(result.token).toBe('signed-token');
    expect(typeof result.expiresAt).toBe('string');
    // ISO-8601 date string
    expect(() => new Date(result.expiresAt)).not.toThrow();
  });

  it('calls jwtService.sign with the correct payload', () => {
    const jwtService = makeJwtService();
    const service = new AdminImpersonationService(jwtService);

    service.impersonate(
      { id: 'user-1', email: 'user@example.com', name: 'Alice' },
      'admin@example.com',
    );

    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: 'user-1',
        email: 'user@example.com',
        name: 'Alice',
        impersonatedBy: 'admin@example.com',
      },
      { expiresIn: '15m' },
    );
  });

  it('defaults name to empty string when targetUser.name is undefined', () => {
    const jwtService = makeJwtService();
    const service = new AdminImpersonationService(jwtService);

    service.impersonate(
      { id: 'user-2', email: 'user2@example.com' },
      'admin@example.com',
    );

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ name: '' }),
      expect.any(Object),
    );
  });

  it('expiresAt is approximately 15 minutes in the future', () => {
    const jwtService = makeJwtService();
    const service = new AdminImpersonationService(jwtService);

    const before = Date.now();
    const result = service.impersonate(
      { id: 'u', email: 'e@x.com' },
      'admin@x.com',
    );
    const after = Date.now();

    const expiresTs = new Date(result.expiresAt).getTime();
    const fifteenMin = 15 * 60 * 1000;

    expect(expiresTs).toBeGreaterThanOrEqual(before + fifteenMin);
    expect(expiresTs).toBeLessThanOrEqual(after + fifteenMin);
  });

  it('passes the adminEmail as impersonatedBy in the payload', () => {
    const jwtService = makeJwtService();
    const service = new AdminImpersonationService(jwtService);

    service.impersonate({ id: 'u', email: 'u@x.com' }, 'superadmin@corp.com');

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ impersonatedBy: 'superadmin@corp.com' }),
      expect.any(Object),
    );
  });
});
