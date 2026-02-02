import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { MongoConnectionService } from '../services/mongo/mongo-connection.service';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationController],
  providers: [MongoConnectionService, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
