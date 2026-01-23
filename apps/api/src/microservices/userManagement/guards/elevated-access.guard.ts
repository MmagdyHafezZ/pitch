import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { toRpcException } from '@pitch/shared-backend/helpers/exceptions';
import { TeamRepository } from '../team/repositories/team.repository';

@Injectable()
export class ElevatedAccessGuard implements CanActivate {
  constructor(private readonly teamRepository: TeamRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const data = context.switchToRpc().getData<any>() ?? {};

    const userId: string | undefined =
      data?.userClaims?.id ??
      data?.payload?.userClaims?.id ??
      data?.meta?.userClaims?.id;

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

  private extractTeamId(data: any): string | undefined {
    // flat
    if (data?.teamId) return data.teamId;

    // common wrappers people use
    if (data?.payload?.teamId) return data.payload.teamId;
    if (data?.payload?.params?.teamId) return data.payload.params.teamId;

    // if your gateway sends { pattern, payload }
    if (data?.data?.teamId) return data.data.teamId;

    // nested object
    if (data?.team?.id) return data.team.id;
    if (data?.payload?.team?.id) return data.payload.team.id;

    return undefined;
  }
}
