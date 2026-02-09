import { forwardRef, Logger, Module } from '@nestjs/common';

import { UserService } from './services/user.service';
import { UserRepository } from './repositories/user.repository';
import { UserController } from './controllers/user.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [UserService, UserRepository, Logger],
  exports: [UserService, UserRepository],
})
export class UserModule {}
