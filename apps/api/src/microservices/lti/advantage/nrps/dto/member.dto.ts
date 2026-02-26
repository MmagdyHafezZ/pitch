import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A single member from the Names and Roles Provisioning Service response.
 * https://www.imsglobal.org/spec/lti-nrps/v2p0
 */
export interface NrpsMember {
  status: 'Active' | 'Inactive' | 'Deleted';
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  user_id: string;
  lti11_legacy_user_id?: string;
  roles: string[];
  message?: Array<{
    'https://purl.imsglobal.org/spec/lti/claim/message_type': string;
    [key: string]: unknown;
  }>;
}

/** Raw NRPS API response shape */
export interface NrpsResponse {
  id: string;
  context?: {
    id: string;
    label: string;
    title: string;
  };
  members: NrpsMember[];
  '@odata.nextLink'?: string; /// Pagination link if roster is large
}

/** Input for fetching NRPS roster */
export class GetMembersDto {
  @ApiPropertyOptional({
    description: 'LTI session ID — must have namesRolesServiceUrl set',
  })
  sessionId: string;

  @ApiPropertyOptional({ description: 'Filter by LTI role URN' })
  role?: string;

  @ApiPropertyOptional({ description: 'Limit number of members returned' })
  limit?: number;
}
