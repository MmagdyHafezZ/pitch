import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartPhoneCallDto {
  @ApiProperty({
    example: 'session_123',
    description: 'Session id to connect the phone call to.',
  })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({
    example: '+15551234567',
    description:
      'Verified destination phone number in E.164 format. This is populated server-side after phone verification checks.',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneNumber?: string;
}

export class PhoneCallResponseDto {
  @ApiProperty({ example: 'call_abc123' })
  @IsString()
  callId: string;

  @ApiProperty({ example: 'vapi' })
  @IsString()
  provider: string;

  @ApiPropertyOptional({ example: 'queued' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  to: string;

  @ApiProperty({ example: '+15557654321' })
  @IsString()
  from: string;

  @ApiProperty({ example: 'session_123' })
  @IsString()
  sessionId: string;
}
