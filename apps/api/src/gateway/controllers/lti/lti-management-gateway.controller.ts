import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { LTI_PATTERNS } from '@microservices/lti/common/constants/lti-patterns.constants';
import { CreatePlatformDto } from '@microservices/lti/platform/dto/create-platform.dto';

/**
 * LTI Platform management endpoints (admin use).
 * Used to register LMS platforms (Canvas, Moodle, etc.) and manage their configs.
 * All routes require JWT authentication.
 */
@ApiTags('LTI Management')
@ApiSecurity('bearer')
@Controller('lti/platforms')
export class LtiManagementGatewayController {
  constructor(@Inject('LTI_SERVICE') private readonly ltiClient: ClientProxy) {}

  @Post()
  @ApiOperation({ summary: 'Register a new LMS platform' })
  create(@Body() dto: CreatePlatformDto) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_CREATE, dto),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all registered LMS platforms' })
  findAll() {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_FIND_ALL, {}),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific platform by ID' })
  findOne(@Param('id') id: string) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_FIND_ONE, { id }),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a platform configuration' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePlatformDto>) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_UPDATE, { id, dto }),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a platform' })
  remove(@Param('id') id: string) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.PLATFORM_DELETE, { id }),
    );
  }

  @Get(':sessionId/session')
  @ApiOperation({ summary: 'Get LTI session details' })
  getSession(@Param('sessionId') sessionId: string) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.SESSION_FIND, { sessionId }),
    );
  }

  @Patch(':sessionId/session/link')
  @ApiOperation({ summary: 'Link an LTI session to a PITCH session' })
  linkSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { pitchSessionId?: string; pitchUserId?: string },
  ) {
    return firstValueFrom(
      this.ltiClient.send(LTI_PATTERNS.SESSION_LINK_PITCH, {
        sessionId,
        ...body,
      }),
    );
  }
}
