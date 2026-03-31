import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type Channel, type ChannelModel } from 'amqplib';
import {
  MICROSERVICES_CONFIG,
  getRabbitMQUrl,
} from '@pitch/shared-backend/config/microservices.config';
import { getDeadLetterQueueName } from '../../../config/rabbitmq-topology';

export interface AdminQueueStats {
  name: string;
  messageCount: number | null;
  consumerCount: number | null;
  deadLetterQueue?: string;
  deadLetterMessageCount?: number | null;
  status: 'ok' | 'missing' | 'error' | 'not_configured';
  error?: string;
}

@Injectable()
export class RabbitMqAdminService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqAdminService.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy() {
    await this.close();
  }

  async getQueueStats(): Promise<AdminQueueStats[]> {
    const channel = await this.tryGetChannel();
    if (!channel) {
      return MICROSERVICES_CONFIG.map(({ queue }) => ({
        name: queue,
        messageCount: null,
        consumerCount: null,
        status: this.resolveConfiguredStatus(),
        error:
          this.resolveConfiguredStatus() === 'not_configured'
            ? 'RabbitMQ URL is not configured'
            : 'RabbitMQ connection is unavailable',
      }));
    }

    const rows = await Promise.all(
      MICROSERVICES_CONFIG.map(async ({ queue }) =>
        this.inspectQueue(channel, queue),
      ),
    );
    return rows;
  }

  async retryDeadLetters(queueName: string, maxMessages = 100) {
    const channel = await this.ensureChannel();
    const deadLetterQueue = await this.findDeadLetterQueue(channel, queueName);

    if (!deadLetterQueue) {
      return {
        queueName,
        deadLetterQueue: null,
        retried: 0,
        status: 'missing' as const,
      };
    }

    let retried = 0;
    while (retried < maxMessages) {
      const message = await channel.get(deadLetterQueue, { noAck: false });
      if (!message) {
        break;
      }

      channel.sendToQueue(queueName, message.content, message.properties);
      channel.ack(message);
      retried += 1;
    }

    return {
      queueName,
      deadLetterQueue,
      retried,
      status: 'ok' as const,
    };
  }

  async getConnectionStatus() {
    try {
      const channel = await this.ensureChannel();
      await channel.checkQueue(
        MICROSERVICES_CONFIG[0]?.queue ?? 'simulation_queue',
      );
      return { status: 'ok' as const };
    } catch (error) {
      return {
        status: this.resolveConfiguredStatus(),
        error: (error as Error)?.message ?? 'RabbitMQ is unavailable',
      };
    }
  }

  protected async inspectQueue(
    channel: Channel,
    queueName: string,
  ): Promise<AdminQueueStats> {
    try {
      const main = await channel.checkQueue(queueName);
      const deadLetterQueue = await this.findDeadLetterQueue(
        channel,
        queueName,
      );
      const deadLetter =
        deadLetterQueue !== null
          ? await channel.checkQueue(deadLetterQueue).catch(() => null)
          : null;

      return {
        name: queueName,
        messageCount: main.messageCount,
        consumerCount: main.consumerCount,
        deadLetterQueue: deadLetterQueue ?? undefined,
        deadLetterMessageCount: deadLetter?.messageCount ?? null,
        status: 'ok',
      };
    } catch (error) {
      return {
        name: queueName,
        messageCount: null,
        consumerCount: null,
        status: 'error',
        error: (error as Error)?.message ?? 'Failed to inspect queue',
      };
    }
  }

  private async findDeadLetterQueue(
    channel: Channel,
    queueName: string,
  ): Promise<string | null> {
    const deadLetterQueue = getDeadLetterQueueName(queueName);

    try {
      await channel.checkQueue(deadLetterQueue);
      return deadLetterQueue;
    } catch {
      return null;
    }
  }

  private async tryGetChannel(): Promise<Channel | null> {
    try {
      return await this.ensureChannel();
    } catch (error) {
      this.logger.warn(
        `RabbitMQ admin channel unavailable: ${(error as Error)?.message ?? error}`,
      );
      return null;
    }
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const url = this.resolveRabbitMqUrl();
    if (!url) {
      throw new Error('RabbitMQ URL is not configured');
    }

    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();
    return this.channel;
  }

  private resolveRabbitMqUrl(): string | undefined {
    try {
      return getRabbitMQUrl();
    } catch {
      return (
        this.configService.get<string>('CLOUDAMQP_URL') ||
        this.configService.get<string>('RABBITMQ_URL') ||
        undefined
      );
    }
  }

  private resolveConfiguredStatus(): 'error' | 'not_configured' {
    return this.resolveRabbitMqUrl() ? 'error' : 'not_configured';
  }

  private async close() {
    if (this.channel) {
      try {
        await this.channel.close();
      } catch {
        // Ignore close errors during shutdown.
      }
      this.channel = undefined;
    }
    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // Ignore close errors during shutdown.
      }
      this.connection = undefined;
    }
  }
}
