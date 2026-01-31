import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportPrismaService } from './support-prisma.service';
import { EmailModule } from './email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [SupportController],
  providers: [SupportService, SupportPrismaService],
})
export class SupportModule {}
