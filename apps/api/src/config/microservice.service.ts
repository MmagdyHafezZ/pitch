import { Injectable, Logger } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { INestApplication } from '@nestjs/common';

export interface MicroserviceDefinition {
  name: string;
  queue: string;
  enabled?: boolean;
  priority?: number;
}

@Injectable()
export class MicroserviceConfigService {
  private readonly logger = new Logger(MicroserviceConfigService.name);

  private readonly defaultServices: MicroserviceDefinition[] = [
    { name: 'AUTH_SERVICE', queue: 'auth_queue', priority: 1 },
    { name: 'USER_SERVICE', queue: 'user_queue', priority: 2 },
    { name: 'BUSINESS_SERVICE', queue: 'business_queue', priority: 3 },
  ];

  /**
   * Get all enabled microservices, sorted by priority
   */
  getEnabledServices(): MicroserviceDefinition[] {
    return this.defaultServices
      .filter((service) => this.isServiceEnabled(service.name))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }

  /**
   * Create microservice options with validation
   */
  createMicroserviceOptions(queue: string): MicroserviceOptions {
    const rabbitmqUrl = this.getRabbitMQUrl();

    if (!rabbitmqUrl) {
      throw new Error('RABBITMQ_URL environment variable is required');
    }

    return {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue,
        queueOptions: {
          durable: true,
        },
      },
    };
  }

  /**
   * Connect all enabled microservices to the application
   */
  async connectAllMicroservices(app: INestApplication): Promise<void> {
    const enabledServices = this.getEnabledServices();

    this.logger.log(`Connecting ${enabledServices.length} microservices...`);

    for (const { name, queue } of enabledServices) {
      try {
        const options = this.createMicroserviceOptions(queue);
        app.connectMicroservice(options);
        this.logger.log(`✅ Connected microservice: ${name} (${queue})`);
      } catch (error) {
        this.logger.error(`❌ Failed to connect microservice: ${name}`, error);
        throw error;
      }
    }

    await app.startAllMicroservices();
    this.logger.log('🚀 All microservices started successfully');
  }

  /**
   * Get client configurations for gateway module
   */
  getClientConfigurations() {
    return this.getEnabledServices().map(({ name, queue }) => ({
      name,
      transport: Transport.RMQ,
      options: {
        urls: [this.getRabbitMQUrl()],
        queue,
        queueOptions: {
          durable: true,
        },
      },
    }));
  }

  private isServiceEnabled(serviceName: string): boolean {
    const envVar = `ENABLE_${serviceName}`;
    return process.env[envVar] !== 'false';
  }

  private getRabbitMQUrl(): string {
    return process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }
}
