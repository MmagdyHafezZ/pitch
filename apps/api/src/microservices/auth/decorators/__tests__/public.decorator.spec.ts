import 'reflect-metadata';
import { IS_PUBLIC_KEY, Public } from '../public.decorator';

describe('Public decorator', () => {
  it('marks the handler metadata with public flag', () => {
    class TestController {
      @Public()
      handler() {}
    }

    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      TestController.prototype.handler,
    );

    expect(isPublic).toBe(true);
  });
});
