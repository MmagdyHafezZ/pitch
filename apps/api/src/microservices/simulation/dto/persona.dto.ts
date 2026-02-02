import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';
import { Prisma } from '@prisma/simulation-client';

export class CreatePersonaDto {
  @ApiProperty({
    description: 'The organization ID this persona belongs to',
    example: 'org_123456789',
  })
  @IsString()
  @IsNotEmpty()
  orgId: string;

  @ApiProperty({
    description: 'The name of the persona',
    example: 'Sales Coach Sarah',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description:
      'Configuration traits for the persona including voice, tone, and behavior',
    example: {
      role: 'Sales Coach',
      tone: 'Professional yet encouraging',
      voice: {
        provider: 'elevenlabs',
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        stability: 0.5,
        similarityBoost: 0.75,
      },
      behavior: {
        patience: 'high',
        correctionStyle: 'constructive',
      },
      context:
        'Used for training junior sales representatives in objection handling.',
    },
  })
  @IsOptional()
  @IsObject()
  traits?: Prisma.InputJsonValue;
}
