import { RpcException } from '@nestjs/microservices';
import { toRpcException } from '../exceptions';

describe('toRpcException', () => {
  it('wraps Error instances', () => {
    const error = new Error('failure');
    const rpcException = toRpcException(error);

    expect(rpcException).toBeInstanceOf(RpcException);
    expect(rpcException.getError()).toBe('failure');
  });

  it('stringifies unknown values', () => {
    const rpcException = toRpcException({ reason: 'oops' });

    expect(rpcException).toBeInstanceOf(RpcException);
    expect(rpcException.getError()).toBe('[object Object]');
  });
});
