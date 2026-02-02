import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../microservices/userManagement/dto/auth.dto';

export class AuthTokenResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
