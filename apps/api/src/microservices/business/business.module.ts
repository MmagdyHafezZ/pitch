import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { BusinessPrismaService } from './business-prisma.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'user_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [BusinessController],
  providers: [BusinessService, BusinessPrismaService],
})
export class BusinessModule {}