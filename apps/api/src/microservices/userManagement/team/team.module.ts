import { Module } from '@nestjs/common';

import { TeamService } from './services/team.service';
import { TeamRepository } from './repositories/team.repository';
import { TeamController } from './controllers/team.controller';
import { ElevatedAccessGuard } from '../guards/elevated-access.guard';

@Module({
  controllers: [TeamController],
  providers: [TeamService, TeamRepository, ElevatedAccessGuard],
  exports: [TeamService, TeamRepository],
})
export class TeamModule {}
