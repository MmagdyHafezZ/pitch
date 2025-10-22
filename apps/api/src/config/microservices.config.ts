import { Transport, MicroserviceOptions } from '@nestjs/microservices';

export interface MicroserviceConfig {
  name: string;
  queue: string;
}

export const MICROSERVICES_CONFIG: MicroserviceConfig[] = [
  { name: 'USER_SERVICE', queue: 'user_queue' },
];

export function createMicroserviceOptions(queue: string): MicroserviceOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [
        process.env.RABBITMQ_URL ||
          'amqp://admin:admin123@localhost:5672/pitch_local',
      ],
      queue,
      noAck: false,
      prefetchCount: 1,
      queueOptions: {
        durable: true,
      },
    },
  };
}

export function getRabbitMQUrl(): string {
  return (
    process.env.RABBITMQ_URL ||
    'amqp://admin:admin123@localhost:5672/pitch_local'
  );
}

export function getQueueOptions() {
  return {
    durable: true,
  };
}
