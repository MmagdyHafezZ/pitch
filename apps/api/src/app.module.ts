import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GatewayModule } from './gateway/gateway.module';
import { UserModule } from './microservices/userManagement/user.module';

@Module({
  imports: [GatewayModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
