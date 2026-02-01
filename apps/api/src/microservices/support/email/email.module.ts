import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { EmailHttpController } from './http-controllers/email.http.controller';
import { EmailRpcController } from './controllers/email.controller';

@Module({
  controllers: [EmailHttpController, EmailRpcController],
  providers: [EmailService],
})
export class EmailModule {}
