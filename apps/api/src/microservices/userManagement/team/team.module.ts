import { Module } from '@nestjs/common';

import { TeamService } from './services/team.service';
import { TeamRepository } from './repositories/team.repository';
import { TeamController } from './controllers/team.controller';

@Module({
  controllers: [TeamController],
  providers: [TeamService, TeamRepository],
  exports: [TeamService],
})
export class TeamModule {}
