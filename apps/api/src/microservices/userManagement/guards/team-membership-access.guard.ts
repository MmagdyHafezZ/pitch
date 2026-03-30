import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { TeamRepository } from '../team/repositories/team.repository';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function getPath(obj: unknown, path: readonly string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function getStringPath(
  obj: unknown,
  path: readonly string[],
): string | undefined {
  const value = getPath(obj, path);
  return typeof value === 'string' ? value : undefined;
}

@Injectable()
export class TeamMembershipAccessGuard implements CanActivate {
  constructor(private readonly teamRepository: TeamRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const raw: unknown = context.switchToRpc().getData();
    const data: unknown = raw ?? {};

    if (isRecord(data) && data['isAdmin'] === true) {
      return true;
    }

    const userId =
      getStringPath(data, ['userClaims', 'id']) ??
      getStringPath(data, ['payload', 'userClaims', 'id']) ??
      getStringPath(data, ['meta', 'userClaims', 'id']);
    const teamId =
      getStringPath(data, ['teamId']) ??
      getStringPath(data, ['payload', 'teamId']) ??
      getStringPath(data, ['payload', 'params', 'teamId']);

    if (!userId) throw new RpcException('Missing userClaims.id in message');
    if (!teamId) throw new RpcException('Missing teamId in message');

    try {
      await this.teamRepository.confirmActiveMembershipOrThrow(userId, teamId);
      return true;
    } catch (error) {
      throw toRpcException(error);
    }
  }
}
