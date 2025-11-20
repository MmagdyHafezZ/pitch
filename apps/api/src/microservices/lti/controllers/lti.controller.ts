import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { LtiService } from '../services/lti.service';

@Controller()
export class LtiController {
  constructor(private readonly service: LtiService) {}

  @MessagePattern('lti.health')
  healthCheck() {
    return { status: 'ok', service: 'lti' };
  }
}
