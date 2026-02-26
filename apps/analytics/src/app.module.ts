import { Module } from '@nestjs/common'
import { ManagerMetricsController } from './controllers/ManagerMetrics.controller'
import { LeaderboardController } from './controllers/Leaderboard.controller'
import { TokenController } from './controllers/Token.controller'
import { UserMetricsController } from './controllers/UserMetrics.controller'
import { IngestController } from './controllers/Ingest.controller'
import { AggregationService } from './services/Aggregation.service'
import { LeaderboardService } from './services/Leaderboard.service'
import { TokenMonitorService } from './services/TokenMonitor.service'
import { SessionizationService } from './services/Sessionization.service'
import { UsageService } from './services/Usage.service'

@Module({
  imports: [],
  controllers: [
    ManagerMetricsController,
    LeaderboardController,
    TokenController,
    UserMetricsController,
    IngestController,
  ],
  providers: [
    AggregationService,
    LeaderboardService,
    TokenMonitorService,
    SessionizationService,
    UsageService,
  ],
})
export class AppModule {}
