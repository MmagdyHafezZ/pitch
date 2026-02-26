import { IsString, IsOptional, IsUrl, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A single content item to be placed into the LMS course.
 * Based on IMS LTI Deep Linking 2.0 spec content item types.
 */
export class LtiResourceLinkItem {
  @ApiProperty({ default: 'ltiResourceLink' })
  type = 'ltiResourceLink' as const;

  @ApiProperty({ description: 'Title shown in the LMS for this activity' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    description: 'Launch URL override (defaults to tool launch URL)',
  })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  custom?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Line item definition for AGS grade sync',
  })
  @IsOptional()
  lineItem?: {
    label: string;
    scoreMaximum: number;
    resourceId?: string;
    tag?: string;
    gradesReleased?: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  available?: { startDateTime?: string; endDateTime?: string };

  @ApiPropertyOptional()
  @IsOptional()
  submission?: { endDateTime?: string };
}

export class ExternalLinkItem {
  @ApiProperty({ default: 'link' })
  type = 'link' as const;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsUrl()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  thumbnail?: { url: string; width?: number; height?: number };

  @ApiPropertyOptional()
  @IsOptional()
  window?: {
    targetName: string;
    width?: number;
    height?: number;
    windowFeatures?: string;
  };
}

export class HtmlFragmentItem {
  @ApiProperty({ default: 'html' })
  type = 'html' as const;

  @ApiProperty()
  @IsString()
  html: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;
}

export type ContentItem =
  | LtiResourceLinkItem
  | ExternalLinkItem
  | HtmlFragmentItem;

export class DeepLinkResponseDto {
  @ApiProperty({
    description: 'LTI session ID (used to look up deep_link_return_url)',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Content items selected by the instructor',
    type: [Object],
  })
  @IsArray()
  items: ContentItem[];

  @ApiPropertyOptional({
    description: 'Message to show to the instructor on success',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Opaque data echoed back from the launch claim',
  })
  @IsOptional()
  @IsString()
  data?: string;
}
