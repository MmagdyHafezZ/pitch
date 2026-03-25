import { Logger } from '@nestjs/common';
import { connect } from 'amqplib';
import {
  MICROSERVICES_CONFIG,
  getQueueOptions,
  getRabbitMQUrl,
} from './microservices.config';

export const RABBITMQ_DEAD_LETTER_EXCHANGE = 'pitch.services.dlx';

export interface RabbitMqQueueTopology {
  queue: string;
  deadLetterQueue: string;
  deadLetterRoutingKey: string;
}

const logger = new Logger('RabbitMqTopology');

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
  const channel = await connection.createChannel();

  try {
    await channel.assertExchange(RABBITMQ_DEAD_LETTER_EXCHANGE, 'direct', {
      durable: true,
    });

    for (const entry of topology) {
      await channel.assertQueue(entry.queue, getQueueOptions());
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
