import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { normalizeError } from '@pitch/shared-backend/helpers/exceptions';
import { SIMULATION_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';
import type { UserClaims as UserClaimsType } from '@pitch/shared-backend/interfaces/user-claims.interface';
import { UserClaims } from '../../decorators/user-claims.decorator';
import { GlobalJwtAuthGuard } from '../../guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../interceptors/user-claims.interceptor';
import {
  CreateScenarioDto,
  GenerateScenarioBatchRequestDto,
  GenerateScenarioRequestDto,
  ScenarioDraftDto,
  ScenarioDraftListResponseDto,
  ScenarioListQueryDto,
  ScenarioListResponseDto,
  ScenarioResponseDto,
  UpdateScenarioDto,
} from '../../../microservices/simulation/dto/scenario.dto';
import { HttpErrorResponseDto } from '../../../microservices/simulation/dto/http-error.dto';

@ApiTags('simulation-scenarios')
@Controller({ path: 'simulation/scenarios', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class ScenarioGatewayController {
  constructor(
    @Inject('SIMULATION_SERVICE')
    private readonly simulationService: ClientProxy,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate an editable scenario draft' })
  @ApiCreatedResponse({ type: ScenarioDraftDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request payload.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  generateScenario(
    @Body() payload: GenerateScenarioRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GENERATE_SCENARIO, {
        ...payload,
        userClaims,
      })
      .pipe(
        timeout(30000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to generate scenario draft';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post('generate/batch')
  @ApiOperation({ summary: 'Generate multiple editable scenario drafts' })
  @ApiCreatedResponse({ type: ScenarioDraftListResponseDto })
  @ApiBadRequestResponse({
    type: HttpErrorResponseDto,
    description: 'Invalid request payload.',
  })
  @ApiInternalServerErrorResponse({
    type: HttpErrorResponseDto,
    description: 'Unexpected error.',
  })
  generateScenarioBatch(
    @Body() payload: GenerateScenarioBatchRequestDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GENERATE_SCENARIO_BATCH, {
        ...payload,
        userClaims,
      })
      .pipe(
        timeout(45000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to generate scenario drafts';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Post()
  @ApiOperation({ summary: 'Save a scenario to the library' })
  @ApiCreatedResponse({ type: ScenarioResponseDto })
  createScenario(
    @Body() payload: CreateScenarioDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.CREATE_SCENARIO, {
        ...payload,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to create scenario';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get()
  @ApiOperation({ summary: 'List scenarios visible to the caller' })
  @ApiOkResponse({ type: ScenarioListResponseDto })
  listScenarios(
    @Query() query: ScenarioListQueryDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.LIST_SCENARIOS, {
        ...query,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to list scenarios';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scenario by ID' })
  @ApiOkResponse({ type: ScenarioResponseDto })
  @ApiNotFoundResponse({
    type: HttpErrorResponseDto,
    description: 'Scenario not found.',
  })
  getScenario(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.GET_SCENARIO, {
        id,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to get scenario';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a saved scenario' })
  @ApiOkResponse({ type: ScenarioResponseDto })
  updateScenario(
    @Param('id') id: string,
    @Body() payload: UpdateScenarioDto,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.UPDATE_SCENARIO, {
        id,
        ...payload,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to update scenario';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved scenario' })
  @ApiNoContentResponse({ description: 'Scenario deleted' })
  deleteScenario(
    @Param('id') id: string,
    @UserClaims() userClaims: UserClaimsType,
  ) {
    return this.simulationService
      .send(SIMULATION_SERVICE_PATTERNS.DELETE_SCENARIO, {
        id,
        userClaims,
      })
      .pipe(
        timeout(10000),
        catchError((err: unknown) => {
          const error = normalizeError(err);
          const message = error.message ?? 'Failed to delete scenario';
          const status = error.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
          return throwError(() => new HttpException(message, status));
        }),
      );
  }
}
