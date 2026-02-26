import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PlatformService } from './platform.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { LTI_PATTERNS } from '../common/constants/lti-patterns.constants';

@Controller()
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @MessagePattern(LTI_PATTERNS.PLATFORM_CREATE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Payload() dto: CreatePlatformDto) {
    return this.service.create(dto);
  }

  @MessagePattern(LTI_PATTERNS.PLATFORM_FIND_ALL)
  findAll() {
    return this.service.findAll();
  }

  @MessagePattern(LTI_PATTERNS.PLATFORM_FIND_ONE)
  findOne(@Payload() data: { id: string }) {
    return this.service.findOne(data.id);
  }

  @MessagePattern(LTI_PATTERNS.PLATFORM_UPDATE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(@Payload() data: { id: string; dto: Partial<CreatePlatformDto> }) {
    return this.service.update(data.id, data.dto);
  }

  @MessagePattern(LTI_PATTERNS.PLATFORM_DELETE)
  remove(@Payload() data: { id: string }) {
    return this.service.remove(data.id);
  }
}
