import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import type { Role } from '@pitch/shared-backend/interfaces/user.interface';

export class ApproveStudioAccessRequestDto {
  @ApiProperty({
    description: 'Quota in coins to allocate to the approved user',
    example: 5000,
  })
  @IsInt()
  @Min(1)
  quota!: number;

  @ApiProperty({
    description: 'Role granted in the provisioned Studio workspace',
    enum: ['MEMBER', 'ADMIN'],
    example: 'MEMBER',
    required: false,
    default: 'MEMBER',
  })
  @IsOptional()
  @IsIn(['MEMBER', 'ADMIN'])
  role?: Extract<Role, 'MEMBER' | 'ADMIN'>;
}
