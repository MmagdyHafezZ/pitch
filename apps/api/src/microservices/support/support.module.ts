import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportPrismaService } from './support-prisma.service';
import { EmailModule } from './email/email.module';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), EmailModule],
  controllers: [SupportController, ChatController],
  providers: [SupportService, SupportPrismaService, ChatService],
})
export class SupportModule {}
