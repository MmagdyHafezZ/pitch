import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class SupportController {
  @MessagePattern('health')
  health() {
    return { status: 'ok', service: 'support' };
  }
}
