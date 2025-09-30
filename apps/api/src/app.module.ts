import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GatewayModule } from './gateway/gateway.module';
import { UserModule } from './microservices/user/user.module';
import { BusinessModule } from './microservices/business/business.module';
import { AuthModule } from './microservices/auth/auth.module';

@Module({
  imports: [GatewayModule, UserModule, BusinessModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
