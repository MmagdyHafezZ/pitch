import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './service/notification.service';
import { MongoConnectionService } from '../mongo/mongo-connection.service';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationController],
  providers: [MongoConnectionService, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
