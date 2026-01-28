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

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const mongoUrl =
      this.configService.get<string>('MONGODB_URL') || process.env.MONGODB_URL;

    if (!mongoUrl) {
      this.logger.warn('MONGODB_URL not configured; MongoDB disabled.');
      return;
    }

    try {
      this.connection = await mongoose.createConnection(mongoUrl).asPromise();
      this.logger.log('Connected to MongoDB for simulation service.');
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB:', error);
      this.connection = null;
    }
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
