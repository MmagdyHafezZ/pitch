import { ApiProperty } from '@nestjs/swagger';

export class HttpErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'LLM provider error [openai/INVALID_REQUEST]: Model is required',
  })
  message: string;

  @ApiProperty({ example: '2024-01-01T12:00:00.000Z' })
  timestamp: string;
}
