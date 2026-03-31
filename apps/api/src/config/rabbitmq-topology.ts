import { Logger } from '@nestjs/common';
import { connect } from 'amqplib';
import {
  MICROSERVICES_CONFIG,
  RABBITMQ_DEAD_LETTER_EXCHANGE,
  getQueueOptions,
  getRabbitMQUrl,
} from '@pitch/shared-backend/config/microservices.config';

export { RABBITMQ_DEAD_LETTER_EXCHANGE } from '@pitch/shared-backend/config/microservices.config';

export interface RabbitMqQueueTopology {
  queue: string;
  deadLetterQueue: string;
  deadLetterRoutingKey: string;
}

const logger = new Logger('RabbitMqTopology');
type RabbitMqConnection = Awaited<ReturnType<typeof connect>>;
type RabbitMqChannel = Awaited<ReturnType<RabbitMqConnection['createChannel']>>;

function attachProvisioningChannelListeners(channel: RabbitMqChannel): void {
  channel.on('error', (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    logger.error(`RabbitMQ provisioning channel error: ${message}`, stack);
  });
}

async function createProvisioningChannel(
  connection: RabbitMqConnection,
): Promise<RabbitMqChannel> {
  const channel = await connection.createChannel();
  attachProvisioningChannelListeners(channel);
  return channel;
}

export function getDeadLetterQueueName(queueName: string): string {
  return `${queueName}.dlq`;
}

export function buildRabbitMqQueueTopology(
  queueName: string,
): RabbitMqQueueTopology {
  return {
    queue: queueName,
    deadLetterQueue: getDeadLetterQueueName(queueName),
    deadLetterRoutingKey: queueName,
  };
}

export const RABBITMQ_QUEUE_TOPOLOGY: RabbitMqQueueTopology[] =
  MICROSERVICES_CONFIG.map(({ queue }) => buildRabbitMqQueueTopology(queue));

export async function provisionRabbitMqTopology(
  rabbitmqUrl = getRabbitMQUrl(),
  topology: RabbitMqQueueTopology[] = RABBITMQ_QUEUE_TOPOLOGY,
): Promise<void> {
  const connection = await connect(rabbitmqUrl);
  const channel = await createProvisioningChannel(connection);

  try {
    await channel.assertExchange(RABBITMQ_DEAD_LETTER_EXCHANGE, 'direct', {
      durable: true,
    });

    for (const entry of topology) {
      await channel.assertQueue(entry.queue, getQueueOptions(rabbitmqUrl));
      await channel.assertQueue(entry.deadLetterQueue, { durable: true });
      await channel.bindQueue(
        entry.deadLetterQueue,
        RABBITMQ_DEAD_LETTER_EXCHANGE,
        entry.deadLetterRoutingKey,
      );
    }

    logger.log(`Provisioned RabbitMQ topology for ${topology.length} queue(s)`);
  } finally {
    try {
      await channel.close();
    } catch {
      // Ignore close errors during shutdown.
    }
    try {
      await connection.close();
    } catch {
      // Ignore close errors during shutdown.
    }
  }
}
