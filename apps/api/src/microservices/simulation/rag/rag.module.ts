import { Module, forwardRef } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagIndexerService } from './rag-indexer.service';
import { SimulationModule } from '../simulation.module';

/**
 * RagModule
 *
 * Provides vector embedding search and ingestion for the simulation microservice.
 *
 * - `RagService`: embed(), retrieve(), indexChunk(), isIndexed(), deleteByRef()
 * - `RagIndexerService`: indexDocument(), indexTurn(), maybeIndexPersona(), maybeIndexScenario()
 *
 * Uses forwardRef(() => SimulationModule) to access SimulationPrismaService.
 * Redis (REDIS_CLIENT) is available globally via the @Global RedisModule.
 */
@Module({
  imports: [forwardRef(() => SimulationModule)],
  providers: [RagService, RagIndexerService],
  exports: [RagService, RagIndexerService],
})
export class RagModule {}
