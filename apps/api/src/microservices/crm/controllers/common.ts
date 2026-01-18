import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class NotImplementedResponse {
  @ApiProperty({ example: HttpStatus.NOT_IMPLEMENTED })
  statusCode: number;

  @ApiProperty({ example: 'Not Implemented' })
  message: string;

  @ApiProperty({ example: 'This endpoint is not yet implemented' })
  description: string;
}

export class PaginatedResponse<T> {
  @ApiProperty({ description: 'Array of items' })
  data: T[];

  @ApiProperty({ example: 100, description: 'Total count of items' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page' })
  page: number;

  @ApiProperty({ example: 20, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 5, description: 'Total pages' })
  totalPages: number;
}

export function notImplemented(resource: string, action: string) {
  return {
    statusCode: HttpStatus.NOT_IMPLEMENTED,
    message: 'Not Implemented',
    description: `${action} ${resource} is not yet implemented`,
  };
}
