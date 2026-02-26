import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LtiV1p1Service } from '../services/lti-v1.1.service';
import { LtiV1p1LaunchDto, LtiV1p1GradeDto } from '../dto/lti-v1.1-launch.dto';
import { LTI_PATTERNS } from '../../common/constants/lti-patterns.constants';

@Controller()
export class LtiV1p1Controller {
  constructor(private readonly service: LtiV1p1Service) {}

  @MessagePattern(LTI_PATTERNS.V1P1_LAUNCH)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  launch(
    @Payload()
    data: {
      dto: LtiV1p1LaunchDto;
      requestUrl: string;
      method: string;
    },
  ) {
    return this.service.validateLaunch(data.dto, data.requestUrl, data.method);
  }

  @MessagePattern(LTI_PATTERNS.V1P1_GRADE)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  grade(@Payload() dto: LtiV1p1GradeDto) {
    return this.service.submitGrade(dto);
  }
}
