import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose, { Connection, Model, Schema } from 'mongoose';

@Injectable()
export class MongoConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoConnectionService.name);
  private connection: Connection | null = null;
  private mongoUrl: string | null = null;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.mongoUrl =
      this.configService.get<string>('USER_MANAGEMENT_MONGODB_URL') ||
      process.env.USER_MANAGEMENT_MONGODB_URL;

    if (!this.mongoUrl) {
      this.logger.warn(
        'USER_MANAGEMENT_MONGODB_URL not configured; notifications disabled.',
      );
      return;
    }

    await this.connect();
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  isConnected(): boolean {
    return (
      !!this.connection &&
      this.connection.readyState === mongoose.ConnectionStates.connected
    );
  }

  async waitUntilConnected(timeoutMs = 10000): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }

    if (!this.mongoUrl) {
      return false;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.isConnected()) {
        return true;
      }

      await this.connect();

      if (this.isConnected()) {
        return true;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
      });
    }

    return this.isConnected();
  }

  private async connect(): Promise<void> {
    if (this.isConnected() || this.connectPromise || !this.mongoUrl) {
      return;
    }

    this.connectPromise = mongoose
      .createConnection(this.mongoUrl)
      .asPromise()
      .then((connection) => {
        this.connection = connection;
        this.logger.log('Connected to MongoDB for user management service.');
      })
      .catch((error: unknown) => {
        this.logger.error('Failed to connect to MongoDB:', error);
        this.connection = null;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    await this.connectPromise;
  }

  getModel<T>(name: string, schema: Schema<T>): Model<T> {
    if (!this.connection) {
      throw new Error('MongoDB connection is not initialized');
    }

    if (this.connection.models[name]) {
      return this.connection.models[name] as Model<T>;
    }

    return this.connection.model<T>(name, schema);
  }
}
