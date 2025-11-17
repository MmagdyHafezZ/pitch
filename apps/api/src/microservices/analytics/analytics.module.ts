import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { MetricsService } from './services/metrics.service';
import { DashboardService } from './services/dashboard.service';
import { ReportService } from './services/report.service';
import { AnalyticsRepository } from './repositories/analytics.repository';
import { PrismaService } from './services/prisma.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    PrismaService,
    AnalyticsService,
    MetricsService,
    DashboardService,
    ReportService,
    AnalyticsRepository,
  ],
  exports: [AnalyticsService, MetricsService],
})
export class AnalyticsModule {}
