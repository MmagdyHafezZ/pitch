import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LtiV1p3Service } from '../services/lti-v1.3.service';
import { OidcService } from '../services/oidc.service';
import { JwksService } from '../services/jwks.service';
import { OidcLoginDto } from '../dto/oidc-login.dto';
import { LTI_PATTERNS } from '../../common/constants/lti-patterns.constants';

@Controller()
export class LtiV1p3Controller {
  constructor(
    private readonly v1p3Service: LtiV1p3Service,
    private readonly oidcService: OidcService,
    private readonly jwksService: JwksService,
  ) {}

  @MessagePattern(LTI_PATTERNS.V1P3_OIDC_LOGIN)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  oidcLogin(@Payload() data: { dto: OidcLoginDto; toolLaunchUrl: string }) {
    return this.oidcService.initiateLogin(data.dto, data.toolLaunchUrl);
  }

  @MessagePattern(LTI_PATTERNS.V1P3_LAUNCH)
  verifyLaunch(@Payload() data: { idToken: string; state: string }) {
    return this.v1p3Service.verifyLaunch(data.idToken, data.state);
  }

  @MessagePattern(LTI_PATTERNS.V1P3_JWKS)
  getToolJwks() {
    return this.jwksService.getToolJwks();
  }
}
