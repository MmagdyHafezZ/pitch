import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import {
  LLMRoutingConfigQueryDto,
  LLMRoutingConfigUpsertDto,
} from '../dto/llm-routing.dto';
import { LLMRoutingConfigService } from '../services/llm/llm-routing-config.service';

@Controller()
export class LLMRoutingController {
  constructor(private readonly routingConfig: LLMRoutingConfigService) {}

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LLM_ROUTING_GET)
  getConfig(@Payload() payload?: LLMRoutingConfigQueryDto) {
    return this.routingConfig.getActiveConfig(payload ?? {});
  }

  @MessagePattern(SIMULATION_SERVICE_PATTERNS.LLM_ROUTING_UPSERT)
  upsertConfig(@Payload() payload: LLMRoutingConfigUpsertDto) {
    return this.routingConfig.upsertConfig(payload);
  }
}
