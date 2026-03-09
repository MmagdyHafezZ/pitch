import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GatewayModule } from './gateway/gateway.module';
import { UserMicroserviceModule } from './microservices/userManagement/user-microservice.module';
import { SupportModule } from '@microservices/support/support.module';
import { SimulationModule } from '@microservices/simulation/simulation.module';
import { AnalyticsModule } from '@microservices/analytics/analytics.module';
import { CrmModule } from '@microservices/crm/crm.module';
import { S3Module } from '@microservices/s3/s3.module';
import { LtiModule } from '@microservices/lti/lti.module';
import { JobsModule } from '@microservices/jobs/jobs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GatewayModule,
    UserMicroserviceModule,
    SupportModule,
    SimulationModule,
    AnalyticsModule,
    S3Module,
    CrmModule,
    LtiModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
