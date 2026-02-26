import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * LTI 1.1 launch POST parameters sent from the LMS.
 * These are OAuth 1.0a signed form fields.
 */
export class LtiV1p1LaunchDto {
  // OAuth 1.0a fields
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  oauth_consumer_key: string;

  @ApiProperty()
  @IsString()
  oauth_signature: string;

  @ApiProperty()
  @IsString()
  oauth_signature_method: string; // must be HMAC-SHA1

  @ApiProperty()
  @IsString()
  oauth_timestamp: string;

  @ApiProperty()
  @IsString()
  oauth_nonce: string;

  @ApiProperty()
  @IsString()
  oauth_version: string; // 1.0

  // LTI core fields
  @ApiProperty()
  @IsString()
  lti_message_type: string; // basic-lti-launch-request

  @ApiProperty()
  @IsString()
  lti_version: string; // LTI-1p0

  @ApiProperty()
  @IsString()
  resource_link_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resource_link_title?: string;

  // User
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lis_person_contact_email_primary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lis_person_name_full?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lis_person_name_given?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lis_person_name_family?: string;

  // Roles
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roles?: string; // comma-separated

  // Course context
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  context_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  context_label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  context_title?: string;

  // Grade passback (LTI 1.1 Basic Outcomes)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lis_result_sourcedid?: string; /// Opaque identifier for grade passback

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lis_outcome_service_url?: string; /// URL to submit grades to

  // Tool consumer info
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tool_consumer_instance_guid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tool_consumer_info_product_family_code?: string;

  // Custom parameters (prefixed with custom_)
  [key: string]: string | undefined;
}

/**
 * LTI 1.1 Basic Outcome grade passback request payload.
 * The actual grade passback uses XML POSTs, but we accept a parsed form here.
 */
export class LtiV1p1GradeDto {
  @ApiProperty({ description: 'The lis_result_sourcedid from the launch' })
  @IsString()
  sourcedId: string;

  @ApiProperty({ description: 'Normalised score 0.0 – 1.0' })
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: 'Platform consumer key for auth lookup' })
  @IsString()
  consumerKey: string;

  @ApiProperty({ description: 'LMS grade passback URL' })
  @IsString()
  outcomeServiceUrl: string;
}
