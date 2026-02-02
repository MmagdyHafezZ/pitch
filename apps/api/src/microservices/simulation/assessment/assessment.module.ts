import { Module, forwardRef } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AssessmentService } from './assessment.service';
import { AssessmentController } from './controllers/assessment.controller';
import { AssessmentRpcController } from './rpc/assessment.rpc';
import { AssessmentWorker } from './workers/assessment.worker';
import { AssessmentRepository } from './repositories/assessment.repository';
import { AssessmentReportRepository } from './repositories/assessment-report.repository';
import { AssessmentGraphRunner } from './langgraph/assessment-graph';
import { AssessmentQueuePublisher } from './assessment.queue';
import { SimulationModule } from '../simulation.module';
import { getQueueOptions, getRabbitMQUrl } from '../config/rabbitmq.config';

@Module({
  imports: [
    forwardRef(() => SimulationModule),
    ClientsModule.register([
      {
        name: 'SIMULATION_QUEUE_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: [getRabbitMQUrl()],
          queue: 'simulation_queue',
          queueOptions: getQueueOptions(),
        },
      },
    ]),
  ],
  controllers: [
    AssessmentController,
    AssessmentRpcController,
    AssessmentWorker,
  ],
  providers: [
    AssessmentService,
    AssessmentRepository,
    AssessmentReportRepository,
    AssessmentGraphRunner,
    AssessmentQueuePublisher,
  ],
  exports: [AssessmentService],
})
export class AssessmentModule {}
