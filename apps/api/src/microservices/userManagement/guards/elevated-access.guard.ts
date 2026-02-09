import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { TeamRepository } from '../team/repositories/team.repository';

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null;
}

function getPath(obj: unknown, path: readonly string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function getStringPath(
  obj: unknown,
  path: readonly string[],
): string | undefined {
  const v = getPath(obj, path);
  return typeof v === 'string' ? v : undefined;
}

@Injectable()
export class ElevatedAccessGuard implements CanActivate {
  constructor(private readonly teamRepository: TeamRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const raw: unknown = context.switchToRpc().getData();
    const data: unknown = raw ?? {};

    const userId =
      getStringPath(data, ['userClaims', 'id']) ??
      getStringPath(data, ['payload', 'userClaims', 'id']) ??
      getStringPath(data, ['meta', 'userClaims', 'id']);

    const teamId = this.extractTeamId(data);

    if (!userId) throw new RpcException('Missing userClaims.id in message');
    if (!teamId) throw new RpcException('Missing teamId in message');

    try {
      await this.teamRepository.confirmAuthorityOrThrow(userId, teamId);
      return true;
    } catch (e) {
      throw toRpcException(e);
    }
  }

  private extractTeamId(data: unknown): string | undefined {
    return (
      getStringPath(data, ['teamId']) ??
      getStringPath(data, ['payload', 'teamId']) ??
      getStringPath(data, ['payload', 'params', 'teamId']) ??
      getStringPath(data, ['data', 'teamId']) ??
      getStringPath(data, ['team', 'id']) ??
      getStringPath(data, ['payload', 'team', 'id'])
    );
  }
}
