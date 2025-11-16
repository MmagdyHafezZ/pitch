import { Transport, MicroserviceOptions } from '@nestjs/microservices';

export interface MicroserviceConfig {
  name: string;
  queue: string;
}

export const MICROSERVICES_CONFIG: MicroserviceConfig[] = [
  { name: 'USER_SERVICE', queue: 'user_queue' },
  { name: 'TEAM_SERVICE', queue: 'team_queue' },
];

/**
 * Creates microservice configuration options for RabbitMQ transport
 *
 * IMPORTANT: Requires RABBITMQ_URL environment variable to be set.
 * Format: amqp://user:password@host:port/vhost
 *
 * @param queue - Queue name for this microservice
 * @returns MicroserviceOptions configured for RabbitMQ
 * @throws Error if RABBITMQ_URL is not set
 */
export function createMicroserviceOptions(queue: string): MicroserviceOptions {
  const url = getRabbitMQUrl();

  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue,
      noAck: false,
      prefetchCount: 1,
      queueOptions: {
        durable: true,
      },
    },
  };
}

/**
 * Gets RabbitMQ connection URL from environment
 *
 * SECURITY: This function enforces that RABBITMQ_URL must be set.
 * Never commit credentials to source control.
 *
 * @returns RabbitMQ connection URL
 * @throws Error if RABBITMQ_URL environment variable is not set
 */
export function getRabbitMQUrl(): string {
  const url = process.env.RABBITMQ_URL;

  if (!url) {
    throw new Error(
      'RABBITMQ_URL environment variable is required. ' +
        'Format: amqp://username:password@host:port/vhost',
    );
  }

  return url;
}

export function getQueueOptions() {
  return {
    durable: true,
  };
}
