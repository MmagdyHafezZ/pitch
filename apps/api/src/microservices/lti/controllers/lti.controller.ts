import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LtiService } from '../services/lti.service';

@Controller()
export class LtiController {
  constructor(private readonly service: LtiService) {}

  @MessagePattern('lti.health')
  async healthCheck() {
    return { status: 'ok', service: 'lti' };
  }
}
