import type { ExecutionContext } from '@nestjs/common';
import { LocalAuthGuard } from '../local-auth.guard';

describe('LocalAuthGuard', () => {
  it('creates a guard instance', () => {
    const guard = new LocalAuthGuard();
    expect(guard).toBeInstanceOf(LocalAuthGuard);
  });

  it('delegates canActivate to the base AuthGuard implementation', async () => {
    const guard = new LocalAuthGuard();
    const prototype = Object.getPrototypeOf(guard);
    const canActivateSpy = jest
      .spyOn(prototype, 'canActivate')
      .mockResolvedValue(true as any);

    const context = {} as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(canActivateSpy).toHaveBeenCalledWith(context);

    canActivateSpy.mockRestore();
  });

  it('delegates handleRequest to the base AuthGuard implementation', () => {
    const guard = new LocalAuthGuard();
    const prototype = Object.getPrototypeOf(guard);
    const handleRequestSpy = jest
      .spyOn(prototype, 'handleRequest')
      .mockReturnValue({ id: 'user-1' } as any);

    const result = guard.handleRequest(null, null, { id: 'user-1' } as any);

    expect(handleRequestSpy).toHaveBeenCalledWith(null, null, { id: 'user-1' });
    expect(result).toEqual({ id: 'user-1' });

    handleRequestSpy.mockRestore();
  });
});
