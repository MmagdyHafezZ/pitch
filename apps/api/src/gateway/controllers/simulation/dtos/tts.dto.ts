import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SpeakRequestDto {
  @ApiProperty({
    description: 'Text to convert to speech',
    example: 'Hello world',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    description: 'TTS provider name',
    example: 'elevenlabs',
    enum: ['elevenlabs', 'polly', 'openai', 'melotts'],
  })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({
    description: 'Voice identifier for the provider',
    example: 'Alice - Clear, Engaging Educator',
  })
  @IsString()
  @IsNotEmpty()
  voice: string;

  @ApiPropertyOptional({
    description:
      'Optional model identifier for providers that expose multiple TTS models',
    example: 'gpt-4o-mini-tts',
  })
  @IsString()
  @IsOptional()
  model?: string;
}

export class ProviderVoiceDto {
  @ApiProperty({
    description: 'Voice name/identifier',
    example: 'Alice - Clear, Engaging Educator',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Optional voice description',
    example: 'Clear and engaging educator voice',
  })
  description?: string;
}

export class ProviderInfoDto {
  @ApiProperty({
    description: 'Provider name',
    example: 'elevenlabs',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Provider description',
    example: 'ElevenLabs neural text-to-speech',
  })
  description?: string;

  @ApiProperty({
    description: 'Available voices for this provider',
    type: [String],
    example: ['Alice - Clear, Engaging Educator', 'Rachel', 'George'],
  })
  voices: string[];

  @ApiPropertyOptional({
    description: 'Available models for this provider',
    type: [String],
    example: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
  })
  models?: string[];
}

export class VoicesResponseDto {
  @ApiProperty({
    description: 'Provider name',
    example: 'elevenlabs',
  })
  provider: string;

  @ApiProperty({
    description: 'Available voices',
    type: [String],
    example: ['Alice - Clear, Engaging Educator', 'Rachel', 'George'],
  })
  voices: string[];

  @ApiPropertyOptional({
    description: 'Available models for the provider',
    type: [String],
    example: ['gpt-4o-mini-tts', 'tts-1', 'tts-1-hd'],
  })
  models?: string[];
}
