import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GlobalJwtAuthGuard } from '../../../gateway/guards/global-jwt-auth.guard';
import { UserClaimsInterceptor } from '../../../gateway/interceptors/user-claims.interceptor';
import { RagService } from './rag.service';
import { RagIndexerService } from './rag-indexer.service';
import { IndexDocumentDto } from './dto/index-document.dto';
import { RetrieveDto } from './dto/retrieve.dto';

@ApiTags('rag')
@Controller({ path: 'rag', version: '1' })
@UseGuards(GlobalJwtAuthGuard)
@UseInterceptors(UserClaimsInterceptor)
@ApiBearerAuth('bearer')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly ragIndexerService: RagIndexerService,
  ) {}

  /**
   * Index a knowledge-base document for the caller's org.
   * The document is chunked (300-word windows, 50-word overlap) and stored
   * as vector embeddings in the `kb` namespace.
   */
  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Chunk and index a KB document' })
  async indexDocument(@Body() dto: IndexDocumentDto) {
    const orgId = dto.orgId;
    const refId = dto.refId ?? `doc_${Date.now()}`;

    await this.ragIndexerService.indexDocument({
      text: dto.text,
      orgId,
      refType: 'Doc',
      refId,
      source: dto.source,
    });

    return { refId, orgId, status: 'indexed' };
  }

  /**
   * List all indexed documents for the caller's org.
   */
  @Get('documents')
  @ApiOperation({ summary: 'List indexed KB documents for an org' })
  async listDocuments(
    @Query('orgId') orgId: string,
    @Query('refType') refType?: string,
  ) {
    const rows = await this.ragService.listByOrg(orgId, refType);
    return { items: rows };
  }

  /**
   * Delete all embedding chunks for a specific document refId.
   */
  @Delete('documents/:refId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all embeddings for a document refId' })
  async deleteDocument(@Param('refId') refId: string) {
    const indexed = await this.ragService.isIndexed('Doc', refId);
    if (!indexed)
      throw new NotFoundException(`No indexed document with refId: ${refId}`);
    await this.ragService.deleteByRef('Doc', refId);
  }

  /**
   * Test / debug endpoint: retrieve chunks similar to an ad-hoc query.
   * Useful during setup to verify embeddings are working correctly.
   */
  @Post('search')
  @ApiOperation({ summary: 'Ad-hoc semantic search (debug / admin)' })
  async search(@Body() dto: RetrieveDto) {
    const chunks = await this.ragService.retrieve({
      query: dto.query,
      namespaces: dto.namespaces,
      topK: dto.topK ?? 5,
      minScore: dto.minScore ?? 0.7,
    });
    return { chunks };
  }
}
