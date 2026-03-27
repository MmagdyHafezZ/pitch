import { Transport, MicroserviceOptions } from '@nestjs/microservices';

export interface MicroserviceConfig {
  name: string;
  queue: string;
}

export const RABBITMQ_DEAD_LETTER_EXCHANGE = 'pitch.services.dlx';

export const MICROSERVICES_CONFIG: MicroserviceConfig[] = [
  { name: 'USER_SERVICE', queue: 'user_queue' },
  { name: 'SIMULATION_SERVICE', queue: 'simulation_queue' },
  { name: 'ANALYTICS_SERVICE', queue: 'analytics_queue' },
  { name: 'SUPPORT_SERVICE', queue: 'support_queue' },
  { name: 'LTI_SERVICE', queue: 'lti_queue' },
  { name: 'S3_SERVICE', queue: 's3_queue' },
  { name: 'CRM_SERVICE', queue: 'crm_queue' },
  { name: 'JOBS_SERVICE', queue: 'jobs_queue' },
  { name: 'GATEWAY_SERVICE', queue: 'gateway_queue' },
];

/**
 * Creates microservice configuration options for RabbitMQ transport
 *
 * IMPORTANT: Requires RabbitMQ URL environment variable to be set.
 * - DEP_MODE=local -> RABBITMQ_URL
 * - DEP_MODE=prod -> CLOUDAMQP_URL
 * Format: amqp://user:password@host:port/vhost
 *
 * @param queue - Queue name for this microservice
 * @returns MicroserviceOptions configured for RabbitMQ
 * @throws Error if required RabbitMQ URL is not set
 */
export function createMicroserviceOptions(queue: string): MicroserviceOptions {
  const url = getRabbitMQUrl();

  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue,
      noAck: true,
      prefetchCount: 10,
      queueOptions: getQueueOptions(url),
      socketOptions: {
        heartbeatIntervalInSeconds: 60,
      },
    },
  };
}

/**
 * Gets RabbitMQ connection URL from environment
 *
 * SECURITY: This function enforces that the correct RabbitMQ URL is set.
 * Never commit credentials to source control.
 *
 * @returns RabbitMQ connection URL
 * @throws Error if required RabbitMQ URL environment variable is not set
 */
export function getRabbitMQUrl(): string {
  const mode = (process.env.DEP_MODE ?? '').trim().toLowerCase();
  const isProd = mode === 'prod' || mode === 'production';
  const url = isProd ? process.env.CLOUDAMQP_URL : process.env.RABBITMQ_URL;

  if (!url) {
    const missingVar = isProd ? 'CLOUDAMQP_URL' : 'RABBITMQ_URL';
    throw new Error(
      `${missingVar} environment variable is required. ` +
        'Format: amqp://username:password@host:port/vhost',
    );
  }

  return url;
}

export function usesRabbitMqPolicyDeadLettering(
  rabbitmqUrl = getRabbitMQUrl(),
): boolean {
  try {
    const parsed = new URL(rabbitmqUrl);
    const vhost = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));

    return vhost === 'pitch_local';
  } catch {
    return false;
  }
}

export function getQueueOptions(rabbitmqUrl = getRabbitMQUrl()) {
  if (usesRabbitMqPolicyDeadLettering(rabbitmqUrl)) {
    return {
      durable: true,
    };
  }

  return getDeadLetterQueueOptions();
}

export function getDeadLetterQueueOptions() {
  return {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': RABBITMQ_DEAD_LETTER_EXCHANGE,
    },
  };
}
