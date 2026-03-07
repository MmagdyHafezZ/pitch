// apps/support/src/dto/email.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { SupportEmailTemplate } from '@pitch/shared-backend/interfaces/support-email.interface';

export class EmailFromDto {
  @ApiPropertyOptional({ example: 'PITCH' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'no-reply@pitch.ai' })
  @IsString()
  address!: string;
}

export class TextContentDto {
  @ApiProperty({ enum: ['text'], example: 'text' })
  @IsIn(['text'])
  kind!: 'text';

  @ApiProperty({ example: 'Your verification code is 123456' })
  @IsString()
  text!: string;
}

export class HtmlContentDto {
  @ApiProperty({ enum: ['html'], example: 'html' })
  @IsIn(['html'])
  kind!: 'html';

  @ApiProperty({ example: '<p>Your verification code is <b>123456</b></p>' })
  @IsString()
  html!: string;

  @ApiPropertyOptional({ example: 'Your verification code is 123456' })
  @IsOptional()
  @IsString()
  textFallback?: string;
}

export class SendEmailDto {
  @ApiProperty({
    oneOf: [
      { type: 'string', format: 'email' },
      { type: 'array', items: { type: 'string', format: 'email' } },
    ],
    example: 'magdy.hafez9123@gmail.com',
  })
  @ValidateIf((o: SendEmailDto) => Array.isArray(o.to))
  @IsArray()
  @IsEmail({}, { each: true })
  to!: string | string[];

  @ApiProperty({ example: 'PITCH - Verification Code' })
  @IsString()
  subject!: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(TextContentDto) },
      { $ref: getSchemaPath(HtmlContentDto) },
    ],
  })
  @Type(() => Object)
  @IsObject()
  content!: TextContentDto | HtmlContentDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => EmailFromDto)
  from?: EmailFromDto;

  @ApiPropertyOptional({ example: 'support@pitch.ai' })
  @IsOptional()
  @IsString()
  replyTo?: string;

  @ApiPropertyOptional({ example: { 'X-Request-Id': 'abc123' } })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class SendVerificationCodeDto {
  @ApiProperty({ example: 'magdy.hafez9123@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ example: 'login' })
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class SendTemplatedEmailDto {
  @ApiProperty({ example: 'person@example.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({
    enum: SupportEmailTemplate,
    example: SupportEmailTemplate.USER_SIGNUP_INVITE,
  })
  @IsEnum(SupportEmailTemplate)
  template!: SupportEmailTemplate;

  @ApiPropertyOptional({
    description:
      'Template payload. For USER_SIGNUP_INVITE use signupUrl/teamName/invitedByName.',
    example: {
      signupUrl: 'https://app.pitch.ai/signup?invite=abc123',
      teamName: 'Engineering',
      invitedByName: 'Admin User',
    },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
