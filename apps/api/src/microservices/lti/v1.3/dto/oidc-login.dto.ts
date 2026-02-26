import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Parameters sent by the LMS to initiate the OIDC login flow.
 * Corresponds to the LTI 1.3 "third-party initiated login" request.
 * https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
 */
export class OidcLoginDto {
  @ApiProperty({ description: 'Platform issuer URL' })
  @IsString()
  iss: string;

  @ApiProperty({
    description: 'LTI tool login hint (opaque, forwarded to auth endpoint)',
  })
  @IsString()
  login_hint: string;

  @ApiPropertyOptional({
    description: 'Opaque data to forward to platform auth endpoint',
  })
  @IsOptional()
  @IsString()
  lti_message_hint?: string;

  @ApiPropertyOptional({ description: 'Client ID if the platform sends it' })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional({ description: 'Deployment ID if known' })
  @IsOptional()
  @IsString()
  lti_deployment_id?: string;

  @ApiPropertyOptional({ description: 'Target link URI requested' })
  @IsOptional()
  @IsUrl()
  target_link_uri?: string;
}

/**
 * Our generated OIDC authentication request parameters.
 * These are sent as a redirect to the platform's auth endpoint.
 */
export interface OidcAuthRequest {
  /** Redirect target — platform's OIDC auth endpoint */
  redirectUrl: string;

  params: {
    scope: string;
    response_type: string;
    client_id: string;
    redirect_uri: string;
    login_hint: string;
    state: string;
    response_mode: string;
    nonce: string;
    prompt: string;
    lti_message_hint?: string;
  };
}
