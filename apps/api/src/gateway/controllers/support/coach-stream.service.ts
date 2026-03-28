import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import OpenAI from 'openai';
import { buildSystemPrompt, type ChatContext } from './coach.prompts';
import { ALL_COACH_TOOLS } from './coach.tools';
import { SupportAttachmentStorageService } from './support-attachment-storage.service';
import {
  CRM_SERVICE_PATTERNS,
  SIMULATION_SERVICE_PATTERNS,
  USER_SERVICE_PATTERNS,
} from '@pitch/shared-backend/interfaces/message-patterns.interface';

// ─── Public types ─────────────────────────────────────────────────────────────

export type { ChatContext } from './coach.prompts';

export interface Attachment {
  name: string;
  /** text content OR data URL (data:image/…;base64,…) for images. Empty string for S3 uploads. */
  content: string;
  mimeType: string;
  size: number;
  /** Signed attachment URL — set when the file was uploaded to storage instead of sent inline. */
  s3Url?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
}

export interface UIAction {
  type: string;
  label: string;
  path?: string;
  target?: string;
  screen?: string;
  selector?: string;
  reason?: string;
  value?: string;
  steps?: UIAction[];
  docContent?: string;
  format?: string;
}

export type StreamItem =
  | string
  | { action: UIAction }
  | { suggestions: string[] };

type TeamSummary = {
  id: string;
};

type PersonaSummary = {
  id: string;
  name: string;
};

type UserClaimsSummary = {
  id: string;
  email: string;
  name: string;
};

type GeneratedScenarioDetails = {
  scenarioId: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  language: string;
};

// Convenience alias so the tools file type is not exposed in the public API.
type OpenAIMessages = Parameters<
  OpenAI['chat']['completions']['create']
>[0]['messages'];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CoachStreamService {
  private readonly logger = new Logger(CoachStreamService.name);
  private readonly openai: OpenAI;
  private readonly documentModel: string;
  private readonly documentContentCache = new Map<
    string,
    { content: string; expiresAt: number }
  >();

  constructor(
    config: ConfigService,
    @Optional()
    @Inject('CRM_SERVICE')
    private readonly crmClient: ClientProxy | undefined,
    @Optional()
    @Inject('SIMULATION_SERVICE')
    private readonly simulationClient: ClientProxy | undefined,
    @Optional()
    @Inject('USER_SERVICE')
    private readonly userClient: ClientProxy | undefined,
    private readonly attachmentStorage: SupportAttachmentStorageService,
  ) {
    this.openai = new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY') });
    this.documentModel =
      config.get<string>('OPENAI_DOCUMENT_MODEL') ?? 'gpt-4o-mini';
  }

  // ─── Public entry point ────────────────────────────────────────────────────

  async *stream(
    messages: ChatMessage[],
    context?: ChatContext,
    userId?: string,
  ): AsyncGenerator<StreamItem> {
    const systemPrompt = buildSystemPrompt(context);
    const openaiMessages = await this.buildMessagesAsync(
      messages,
      systemPrompt,
      context,
    );
    yield* this.runWithTools(openaiMessages, userId);
  }

  // ─── Tool-use loop ─────────────────────────────────────────────────────────

  /**
   * Runs one OpenAI completion turn.
   *
   * - Text deltas are yielded immediately as strings (SSE tokens).
   * - If the model calls `fetch_document`, the file is fetched server-side,
   *   the tool result is appended to the conversation, and the model is called
   *   again — allowing it to answer using the document's content.
   * - Other tool calls (propose_ui_action, generate_document) are yielded as
   *   structured `{ action }` events consumed by the SSE controller.
   */
  private async *runWithTools(
    messages: OpenAIMessages,
    userId?: string,
  ): AsyncGenerator<StreamItem> {
    let toolName = '';
    let toolJson = '';
    let toolCallId = '';
    let contentBuffer = '';

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 4096,
      messages,
      stream: true,
      tools: ALL_COACH_TOOLS,
      tool_choice: 'auto',
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        contentBuffer += delta.content;
        yield delta.content;
      }
      if (delta?.tool_calls?.[0]) {
        const tc = delta.tool_calls[0];
        if (tc.id) toolCallId = tc.id;
        if (tc.function?.name) toolName = tc.function.name;
        if (tc.function?.arguments) toolJson += tc.function.arguments;
      }
    }

    if (!toolJson) {
      const inferredOptions = this.extractInlineOptions(contentBuffer);
      if (inferredOptions.length > 0) {
        yield { suggestions: inferredOptions };
      }
      return;
    }

    // ── show_options: emit quick-reply suggestions — no model recursion ─────
    if (toolName === 'show_options') {
      try {
        const { options } = JSON.parse(toolJson) as { options: string[] };
        if (Array.isArray(options) && options.length > 0) {
          yield { suggestions: options };
        }
      } catch {
        /* malformed args — skip */
      }
      return;
    }

    // ── get_calendar_events: fetch from CRM then recurse ───────────────────
    if (toolName === 'get_calendar_events') {
      let content: string;
      try {
        const args = JSON.parse(toolJson) as { look_ahead_days?: number };
        const lookAheadDays = Math.min(
          Math.max(args.look_ahead_days ?? 7, 1),
          30,
        );

        if (!this.crmClient || !userId) {
          content =
            '[Calendar not available — user has not connected a calendar or is not authenticated.]';
        } else {
          const events = await this.requestFromClient<
            unknown,
            { userId: string; lookAheadDays: number }
          >(
            this.crmClient,
            CRM_SERVICE_PATTERNS.CALENDAR_GET_UPCOMING,
            {
              userId,
              lookAheadDays,
            },
            8000,
          );
          content = JSON.stringify(events);
        }
      } catch (err) {
        this.logger.warn('get_calendar_events failed: %s', err);
        content =
          '[Calendar events could not be retrieved. The user may not have connected their calendar yet.]';
      }

      const id = toolCallId || 'call_0';
      const updatedMessages: OpenAIMessages = [
        ...messages,
        {
          role: 'assistant',
          content: null as unknown as string,
          tool_calls: [
            {
              id,
              type: 'function',
              function: { name: toolName, arguments: toolJson },
            },
          ],
        },
        { role: 'tool', content, tool_call_id: id },
      ];

      yield* this.runWithTools(updatedMessages, userId);
      return;
    }

    // ── create_session: create a new session in the background ─────────────
    if (toolName === 'create_session') {
      let content: string;
      try {
        const args = JSON.parse(toolJson) as {
          name: string;
          type?: string;
          topic: string;
          objective?: string;
          context?: string;
          ai_role: string;
          user_role: string;
          tone?: string;
          difficulty?: string;
          tags?: string[];
          calendar_event_id?: string;
          calendar_provider?: string;
        };

        if (!this.simulationClient) {
          content =
            '[Background session creation is not available right now. Please create the session manually via the Sessions page.]';
        } else {
          const userClaims = await this.resolveUserClaims(userId);
          const orgId = await this.resolveOrgId(userClaims);
          const personaId = await this.resolvePersonaId(orgId, args.ai_role);
          const scenario = await this.generateScenarioForSession({
            orgId,
            userClaims,
            name: args.name,
            type: args.type ?? 'text',
            topic: args.topic,
            objective: args.objective,
            context: args.context,
            aiRole: args.ai_role,
            userRole: args.user_role,
            tone: args.tone,
            difficulty: args.difficulty,
            tags: args.tags,
            personaId,
            calendarEventId: args.calendar_event_id,
            calendarProvider: args.calendar_provider,
          });

          const session = await this.requestFromClient<
            unknown,
            {
              orgId: string;
              type: string;
              name: string;
              tags: string[];
              sessionConfig: Record<string, unknown>;
              scenarioId: string;
              language: string;
              personaId?: string;
              userClaims: UserClaimsSummary;
            }
          >(
            this.simulationClient,
            SIMULATION_SERVICE_PATTERNS.CREATE_SESSION,
            {
              orgId,
              type: args.type ?? 'text',
              name: args.name,
              tags: [...(args.tags ?? []), 'ai-created'],
              sessionConfig: scenario.config,
              scenarioId: scenario.scenarioId,
              language: scenario.language,
              ...(personaId ? { personaId } : {}),
              userClaims,
            },
            10000,
          );

          const sessionId = this.readStringField(session, 'id') ?? '';
          content = JSON.stringify({
            success: true,
            sessionId,
            sessionUrl: `/studio/sessions/${sessionId}`,
            launchUrl: `/session/${sessionId}`,
            name: args.name,
            topic: args.topic,
            type: args.type ?? 'text',
            aiRole: args.ai_role,
            tone: args.tone ?? 'professional',
            difficulty: args.difficulty ?? 'focused',
            scenarioId: scenario.scenarioId,
            scenarioName: scenario.name,
            personaAssigned: !!personaId,
          });
        }
      } catch (err) {
        this.logger.warn('create_session failed: %s', err);
        content =
          '[Background session creation failed. The user can create the session manually via the Sessions page → Create Session.]';
      }

      const id = toolCallId || 'call_0';
      const updatedMessages: OpenAIMessages = [
        ...messages,
        {
          role: 'assistant',
          content: null as unknown as string,
          tool_calls: [
            {
              id,
              type: 'function',
              function: { name: toolName, arguments: toolJson },
            },
          ],
        },
        { role: 'tool', content, tool_call_id: id },
      ];

      yield* this.runWithTools(updatedMessages, userId);
      return;
    }

    // ── configure_session: apply AI + delivery config to a session ─────────
    if (toolName === 'configure_session') {
      let content: string;
      try {
        const args = JSON.parse(toolJson) as {
          session_id: string;
          topic: string;
          objective?: string;
          context?: string;
          ai_role: string;
          user_role: string;
          tone?: string;
          difficulty?: string;
        };

        if (!this.simulationClient) {
          content =
            '[Session configuration is not available right now. Please configure the session manually using the Edit button.]';
        } else {
          const userClaims = await this.resolveUserClaims(userId);
          const session = await this.requestFromClient<unknown, { id: string }>(
            this.simulationClient,
            SIMULATION_SERVICE_PATTERNS.GET_SESSION,
            {
              id: args.session_id,
            },
            5000,
          );
          const existing = this.readRecordField(session, 'sessionConfig') ?? {};
          const orgId =
            this.readStringField(session, 'orgId') ??
            (await this.resolveOrgId(userClaims));
          const personaId = await this.resolvePersonaId(orgId, args.ai_role);
          const scenario = await this.generateScenarioForSession({
            orgId,
            userClaims,
            name: this.readStringField(session, 'name') ?? args.topic,
            type: this.readStringField(session, 'type') ?? 'text',
            topic: args.topic,
            objective: args.objective,
            context: args.context,
            aiRole: args.ai_role,
            userRole: args.user_role,
            tone: args.tone,
            difficulty: args.difficulty,
            personaId,
            existingConfig: existing,
          });

          await firstValueFrom(
            this.simulationClient
              .send(SIMULATION_SERVICE_PATTERNS.UPDATE_SESSION, {
                id: args.session_id,
                sessionConfig: scenario.config,
                scenarioId: scenario.scenarioId,
                language: scenario.language,
                ...(personaId ? { personaId } : {}),
                userClaims,
              })
              .pipe(timeout(8000)),
          );

          content = JSON.stringify({
            success: true,
            sessionId: args.session_id,
            configured: {
              aiRole: args.ai_role,
              userRole: args.user_role,
              topic: args.topic,
              objective: args.objective,
              tone: args.tone ?? 'professional',
              difficulty: args.difficulty ?? 'focused',
              llmModel: 'gpt-4o-mini',
              scenarioId: scenario.scenarioId,
              scenarioName: scenario.name,
              personaAssigned: !!personaId,
            },
          });
        }
      } catch (err) {
        this.logger.warn('configure_session failed: %s', err);
        content =
          '[Session configuration failed. The user can configure the session manually using the Edit button on the session detail page.]';
      }

      const id = toolCallId || 'call_0';
      const updatedMessages: OpenAIMessages = [
        ...messages,
        {
          role: 'assistant',
          content: null as unknown as string,
          tool_calls: [
            {
              id,
              type: 'function',
              function: { name: toolName, arguments: toolJson },
            },
          ],
        },
        { role: 'tool', content, tool_call_id: id },
      ];

      yield* this.runWithTools(updatedMessages, userId);
      return;
    }

    // ── fetch_document: fetch content then recurse ──────────────────────────
    if (toolName === 'fetch_document') {
      let content: string;
      try {
        const { url } = JSON.parse(toolJson) as { url: string };
        content = await this.fetchDocumentContent(url);
      } catch (err) {
        this.logger.warn(
          `fetch_document failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        content =
          '[Document could not be fetched. Inform the user and ask them to re-upload.]';
      }

      const id = toolCallId || 'call_0';
      const updatedMessages: OpenAIMessages = [
        ...messages,
        {
          role: 'assistant',
          content: null as unknown as string, // required by OpenAI spec for tool-call turns
          tool_calls: [
            {
              id,
              type: 'function',
              function: { name: toolName, arguments: toolJson },
            },
          ],
        },
        { role: 'tool', content, tool_call_id: id },
      ];

      yield* this.runWithTools(updatedMessages, userId);
      return;
    }

    // ── propose_ui_action / generate_document ──────────────────────────────
    try {
      const parsed = JSON.parse(toolJson) as Record<string, unknown>;

      if (toolName === 'propose_ui_action') {
        yield { action: parsed as unknown as UIAction };
        return;
      }

      if (toolName === 'generate_document') {
        yield {
          action: {
            type: 'generate_document',
            label: (parsed.title as string) ?? 'Document',
            docContent: (parsed.content as string) ?? '',
            format: (parsed.format as string) ?? 'pdf',
          } satisfies UIAction,
        };
        return;
      }
    } catch {
      this.logger.warn(
        'Tool JSON parse failed. toolName=%s len=%d',
        toolName,
        toolJson.length,
      );
      yield "I wasn't able to complete that action — please try again.";
    }
  }

  private extractInlineOptions(content: string): string[] {
    if (!content.trim()) return [];

    // ── [show_options] artifact handling ──────────────────────────────────────
    // The model sometimes writes [show_options] or [show_options: opt1, opt2]
    // as literal text instead of calling the tool. Strip the marker and, if it
    // contained inline options, return them immediately.
    const showOptRe = /\[show_options(?::\s*([^\]]*))?\]\s*\\?\s*/gi;
    let inlineShowOptions: string[] = [];
    const stripped = content.replace(showOptRe, (_match, opts?: string) => {
      if (opts && inlineShowOptions.length === 0) {
        // Prefer | as separator (handles options that contain commas);
        // fall back to , when | is absent.
        const sep = opts.includes('|') ? /\s*\|\s*/ : /\s*,\s*/;
        const parsed = opts
          .split(sep)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parsed.length >= 2 && parsed.length <= 5) {
          inlineShowOptions = parsed;
        }
      }
      return '';
    });

    if (inlineShowOptions.length > 0) return inlineShowOptions;

    // ── Standard extraction on the cleaned text ────────────────────────────────
    const trimmed = stripped.trim();
    if (!trimmed) return [];

    const lines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const bulletOptions = lines
      .filter((line) => /^[-*•]\s+/.test(line))
      .map((line) => line.replace(/^[-*•]\s+/, '').trim())
      .filter(Boolean);

    if (bulletOptions.length >= 2 && bulletOptions.length <= 5) {
      return bulletOptions;
    }

    const bracketMatch = trimmed.match(/\[([^[\]]+)\]\s*$/);
    if (bracketMatch?.[1]) {
      const bracketOptions = bracketMatch[1]
        .split(/\s*,\s*/)
        .map((option) => option.trim())
        .filter(Boolean);

      if (bracketOptions.length >= 2 && bracketOptions.length <= 5) {
        return bracketOptions;
      }
    }

    return [];
  }

  // ─── Message builder ───────────────────────────────────────────────────────

  /**
   * Async wrapper around buildMessages that eagerly pre-fetches any S3 document
   * URLs referenced in user message parts. This avoids the 2-round-trip cost of
   * letting the model call fetch_document itself and prevents "I don't have
   * access" responses when the model ignores the instruction text.
   */
  private async buildMessagesAsync(
    messages: ChatMessage[],
    systemPrompt: string,
    context?: ChatContext,
  ): Promise<OpenAIMessages> {
    const built = this.buildMessages(messages, systemPrompt, context);

    // Pattern injected by appendAttachmentParts for S3 documents
    const docUrlPattern =
      /\[(?:Attached|Saved context) document: [^\]]*?—\s*to read it, call fetch_document with this exact URL:\s*([^\]]+)\]/g;

    for (let mi = 0; mi < built.length; mi++) {
      const msg = built[mi];
      if (msg.role !== 'user') continue;
      const rawContent = msg.content as unknown;

      // Content is either a plain string or an array of content parts
      const isArray = Array.isArray(rawContent);
      const textParts: Array<
        { type: string; text: string } & Record<string, unknown>
      > = isArray
        ? ((rawContent as Array<Record<string, unknown>>).filter(
            (p) => p.type === 'text' && typeof p.text === 'string',
          ) as Array<{ type: string; text: string } & Record<string, unknown>>)
        : typeof rawContent === 'string'
          ? [{ type: 'text', text: rawContent as string }]
          : [];

      for (const part of textParts) {
        const urls: string[] = [];
        let m: RegExpExecArray | null;
        docUrlPattern.lastIndex = 0;
        while ((m = docUrlPattern.exec(part.text)) !== null) {
          const url = m[1].trim();
          if (url) urls.push(url);
        }

        if (urls.length === 0) continue;

        let updated = part.text;
        for (const url of urls) {
          try {
            const docContent = await this.fetchDocumentContent(url);
            const filename = url.split('?')[0].split('/').pop() ?? 'document';
            updated = updated.replace(
              new RegExp(
                `\\[(?:Attached|Saved context) document: [^\\]]*?—\\s*to read it, call fetch_document with this exact URL:\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`,
              ),
              `[Attached document: ${filename}]\n\`\`\`\n${docContent}\n\`\`\``,
            );
          } catch (err) {
            this.logger.warn(
              'Pre-fetch failed for %s: %s — keeping instruction text',
              url,
              err instanceof Error ? err.message : String(err),
            );
          }
        }

        if (updated !== part.text) {
          if (isArray) {
            // Mutate the part in-place (it's a reference into the built array)
            part.text = updated;
          } else {
            (built[mi] as { role: string; content: string }).content = updated;
          }
        }
      }
    }

    return built;
  }

  /**
   * Converts the frontend message array to the OpenAI format, injecting
   * attachments as multimodal content parts:
   *  - S3 documents → text note instructing the model to call fetch_document
   *  - Images       → image_url vision parts (inline base64)
   *  - Text files   → prepended text block
   */
  private buildMessages(
    messages: ChatMessage[],
    systemPrompt: string,
    context?: ChatContext,
  ): OpenAIMessages {
    const result: OpenAIMessages = [{ role: 'system', content: systemPrompt }];
    const savedContextAttachments = context?.savedAttachments ?? [];
    const savedAttachmentKeys = new Set(
      savedContextAttachments.map((att) => this.getAttachmentKey(att)),
    );

    if (savedContextAttachments.length > 0) {
      const parts: Array<{ type: string; [k: string]: unknown }> = [
        {
          type: 'text',
          text: 'These files are pinned in the ongoing coach context. Treat them as available background context until the user removes them.',
        },
      ];

      for (const att of savedContextAttachments) {
        this.appendAttachmentParts(parts, att, 'Saved context');
      }

      result.push({ role: 'user', content: parts as unknown as string });
    }

    for (const msg of messages) {
      const visibleAttachments =
        msg.attachments?.filter(
          (att) => !savedAttachmentKeys.has(this.getAttachmentKey(att)),
        ) ?? [];

      if (visibleAttachments.length === 0) {
        if (!msg.content) {
          continue;
        }
        result.push({ role: msg.role, content: msg.content });
        continue;
      }

      const parts: Array<{ type: string; [k: string]: unknown }> = [];
      if (msg.content) parts.push({ type: 'text', text: msg.content });

      for (const att of visibleAttachments) {
        this.appendAttachmentParts(parts, att, 'Attached');
      }

      result.push({ role: msg.role, content: parts as unknown as string });
    }

    return result;
  }

  private getAttachmentKey(
    attachment: Pick<Attachment, 'name' | 'mimeType' | 'size' | 's3Url'>,
  ): string {
    return (
      attachment.s3Url ??
      `${attachment.name}::${attachment.mimeType}::${attachment.size}`
    );
  }

  private appendAttachmentParts(
    parts: Array<{ type: string; [k: string]: unknown }>,
    attachment: Attachment,
    label: 'Attached' | 'Saved context',
  ): void {
    if (attachment.s3Url) {
      parts.unshift({
        type: 'text',
        text: `[${label} document: ${attachment.name} — to read it, call fetch_document with this exact URL: ${attachment.s3Url}]`,
      });
      return;
    }

    if (attachment.mimeType.startsWith('image/')) {
      parts.unshift({
        type: 'text',
        text: `[${label} image: ${attachment.name}]`,
      });
      parts.push({
        type: 'image_url',
        image_url: { url: attachment.content, detail: 'auto' },
      });
      return;
    }

    parts.unshift({
      type: 'text',
      text: attachment.content
        ? `[${label} file: ${attachment.name}]\n\`\`\`\n${attachment.content}\n\`\`\`\n`
        : `[${label} file: ${attachment.name}]`,
    });
  }

  // ─── Document fetch ────────────────────────────────────────────────────────

  /**
   * Downloads a document from an attachment URL and returns its text content.
   * PITCH attachment URLs are resolved directly from storage to avoid a second
   * HTTP hop through the API. PDFs are read through OpenAI file inputs; other
   * types are decoded as UTF-8.
   */
  private async fetchDocumentContent(url: string): Promise<string> {
    const cached = this.getCachedDocumentContent(url);
    if (cached) {
      return cached;
    }

    const internalAttachment =
      this.attachmentStorage.resolveInternalDownloadUrl(url);

    if (internalAttachment) {
      const { buffer, contentType } =
        await this.attachmentStorage.getObjectFromStorage(
          internalAttachment.bucket,
          internalAttachment.key,
        );

      const parsed = await this.parseDocumentBuffer(buffer, contentType, url);
      this.cacheDocumentContent(url, parsed);
      return parsed;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? '';

    const parsed = await this.parseDocumentBuffer(buffer, contentType, url);
    this.cacheDocumentContent(url, parsed);
    return parsed;
  }

  private async parseDocumentBuffer(
    buffer: Buffer,
    contentType: string,
    source: string,
  ): Promise<string> {
    const isPdf =
      contentType.includes('pdf') ||
      source.split('?')[0].toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return this.extractPdfTextWithOpenAI(buffer, source);
    }

    return buffer.toString('utf-8');
  }

  private getCachedDocumentContent(url: string): string | undefined {
    const cached = this.documentContentCache.get(url);
    if (!cached) {
      return;
    }

    if (cached.expiresAt <= Date.now()) {
      this.documentContentCache.delete(url);
      return;
    }

    return cached.content;
  }

  private cacheDocumentContent(url: string, content: string): void {
    this.documentContentCache.set(url, {
      content,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
  }

  private async extractPdfTextWithOpenAI(
    buffer: Buffer,
    source: string,
  ): Promise<string> {
    const filename = this.getSourceFilename(source);
    const base64 = buffer.toString('base64');
    const response = await this.openai.responses.create({
      model: this.documentModel,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename,
              file_data: `data:application/pdf;base64,${base64}`,
            },
            {
              type: 'input_text',
              text: 'Extract the readable content from this PDF. Preserve the original wording and order as much as possible, including headings, bullets, tables, dates, numbers, and names. If the PDF is too long to reproduce fully, return a dense section-by-section extract that keeps all important details. Return only the document content with no preamble or commentary.',
            },
          ],
        },
      ],
      max_output_tokens: 8000,
    });

    const text = response.output_text?.trim();
    if (!text) {
      throw new Error('PDF extraction returned empty output');
    }

    return text;
  }

  private getSourceFilename(source: string): string {
    try {
      const url = new URL(source);
      const filename = url.pathname.split('/').pop();
      return filename && filename.length > 0 ? filename : 'document.pdf';
    } catch {
      return 'document.pdf';
    }
  }

  private async requestFromClient<TResponse, TPayload>(
    client: ClientProxy,
    pattern: string,
    payload: TPayload,
    timeoutMs: number,
  ): Promise<TResponse> {
    return firstValueFrom(
      client
        .send<TResponse, TPayload>(pattern, payload)
        .pipe(timeout(timeoutMs)),
    );
  }

  private async resolveUserClaims(userId?: string): Promise<UserClaimsSummary> {
    const fallback = {
      id: userId ?? '',
      email: '',
      name: '',
    };

    if (!this.userClient || !userId) {
      return fallback;
    }

    try {
      const user = await this.requestFromClient<
        unknown,
        { userId: string; userClaims: UserClaimsSummary }
      >(
        this.userClient,
        USER_SERVICE_PATTERNS.GET_USER,
        {
          userId,
          userClaims: fallback,
        },
        5000,
      );

      return {
        id: this.readStringField(user, 'id') ?? fallback.id,
        email: this.readStringField(user, 'email') ?? fallback.email,
        name: this.readStringField(user, 'name') ?? fallback.name,
      };
    } catch {
      return fallback;
    }
  }

  private async resolveOrgId(userClaims: UserClaimsSummary): Promise<string> {
    let orgId = userClaims.id;

    if (!this.userClient || !userClaims.id) {
      return orgId;
    }

    try {
      const teams = await this.requestFromClient<
        unknown,
        { userClaims: UserClaimsSummary }
      >(
        this.userClient,
        USER_SERVICE_PATTERNS.GET_USER_TEAMS,
        { userClaims },
        5000,
      );
      const teamList = this.toTeamList(teams);
      if (teamList.length > 0) {
        orgId = teamList[0].id;
      }
    } catch {
      // Fall back to the user's personal workspace.
    }

    return orgId;
  }

  private async resolvePersonaId(
    orgId: string,
    aiRole: string,
  ): Promise<string | undefined> {
    if (!this.simulationClient || !orgId) {
      return;
    }

    try {
      const personaResult = await this.requestFromClient<
        unknown,
        { orgId: string }
      >(
        this.simulationClient,
        SIMULATION_SERVICE_PATTERNS.LIST_PERSONAS,
        { orgId },
        5000,
      );
      const personas = this.toPersonaList(personaResult);
      if (personas.length === 0) {
        return;
      }

      const roleLower = aiRole.toLowerCase();
      const words = roleLower.split(/\s+/);
      const match = personas.find((persona) =>
        words.some(
          (word) =>
            word.length > 3 && persona.name.toLowerCase().includes(word),
        ),
      );
      return (match ?? personas[0]).id;
    } catch {
      return;
    }
  }

  private async generateScenarioForSession(params: {
    orgId: string;
    userClaims: UserClaimsSummary;
    name: string;
    type: string;
    topic: string;
    objective?: string;
    context?: string;
    aiRole: string;
    userRole: string;
    tone?: string;
    difficulty?: string;
    tags?: string[];
    personaId?: string;
    existingConfig?: Record<string, unknown>;
    calendarEventId?: string;
    calendarProvider?: string;
  }): Promise<GeneratedScenarioDetails> {
    if (!this.simulationClient) {
      throw new Error('Simulation client is not available');
    }

    const resolvedAiRole = this.refineSessionAiRole({
      aiRole: params.aiRole,
      topic: params.topic,
      objective: params.objective,
      context: params.context,
    });
    const language =
      this.readStringField(params.existingConfig, 'language') ?? 'en-US';
    const durationMinutes =
      this.readNumberField(params.existingConfig, 'durationMinutes') ?? 20;
    const scenarioHints = this.buildScenarioGenerationHints(params);
    const draft = await this.requestFromClient<
      unknown,
      {
        orgId: string;
        name: string;
        type: string;
        tags: string[];
        language: string;
        objective?: string;
        context?: string;
        personaId?: string;
        sessionConfig: Record<string, unknown>;
        userSnapshot: Record<string, unknown>;
        orgSnapshot: Record<string, unknown>;
        userClaims: UserClaimsSummary;
      }
    >(
      this.simulationClient,
      SIMULATION_SERVICE_PATTERNS.GENERATE_SCENARIO,
      {
        orgId: params.orgId,
        name: params.topic,
        type: params.type,
        tags: params.tags ?? [],
        language,
        ...(params.objective ? { objective: params.objective } : {}),
        ...(params.context ? { context: params.context } : {}),
        ...(params.personaId ? { personaId: params.personaId } : {}),
        sessionConfig: {
          aiRole: resolvedAiRole,
          userRole: params.userRole,
          tone: params.tone ?? 'professional',
          difficulty: params.difficulty ?? 'focused',
          durationMinutes,
          ...scenarioHints,
        },
        userSnapshot: {
          id: params.userClaims.id,
          email: params.userClaims.email,
          name: params.userClaims.name,
        },
        orgSnapshot: {
          id: params.orgId,
        },
        userClaims: params.userClaims,
      },
      15000,
    );

    const draftName = this.readStringField(draft, 'name') ?? params.topic;
    const draftDescription = this.readStringField(draft, 'description');
    const draftConfig = this.readRecordField(draft, 'config') ?? {};
    const persistedScenario = await this.requestFromClient<
      unknown,
      {
        orgId: string;
        name: string;
        description?: string;
        visibility: 'PRIVATE';
        config: Record<string, unknown>;
        userClaims: UserClaimsSummary;
      }
    >(
      this.simulationClient,
      SIMULATION_SERVICE_PATTERNS.CREATE_SCENARIO,
      {
        orgId: params.orgId,
        name: draftName,
        ...(draftDescription ? { description: draftDescription } : {}),
        visibility: 'PRIVATE',
        config: draftConfig,
        userClaims: params.userClaims,
      },
      10000,
    );

    const scenarioId = this.readStringField(persistedScenario, 'id');
    if (!scenarioId) {
      throw new Error('Scenario generation did not return a persisted id');
    }

    return {
      scenarioId,
      name: draftName,
      description: draftDescription,
      config: this.buildSessionConfigFromScenario({
        sessionName: params.name,
        topic: params.topic,
        aiRole: resolvedAiRole,
        userRole: params.userRole,
        tone: params.tone,
        difficulty: params.difficulty,
        scenarioName: draftName,
        scenarioDescription: draftDescription,
        scenarioConfig: draftConfig,
        existingConfig: params.existingConfig,
        calendarEventId: params.calendarEventId,
        calendarProvider: params.calendarProvider,
      }),
      language:
        this.readStringField(draftConfig, 'language') ??
        this.readStringField(params.existingConfig, 'language') ??
        language,
    };
  }

  private buildScenarioGenerationHints(params: {
    topic: string;
    objective?: string;
    context?: string;
    aiRole: string;
    userRole: string;
    tone?: string;
    difficulty?: string;
    existingConfig?: Record<string, unknown>;
    calendarEventId?: string;
    calendarProvider?: string;
  }): Record<string, unknown> {
    const hints: Record<string, unknown> = {
      scenarioTopic: params.topic,
      meetingType: 'upcoming_meeting_preparation',
      tone: params.tone ?? 'professional',
      difficulty: params.difficulty ?? 'focused',
    };
    const existingScenario =
      this.readRecordField(params.existingConfig, 'scenario') ?? {};

    if (params.objective) {
      hints.objective = params.objective;
    }
    if (params.context) {
      hints.context = params.context;
    }
    if (params.calendarEventId) {
      hints.calendarEventId = params.calendarEventId;
      hints.calendarProvider = params.calendarProvider ?? 'google';
    }

    const meetingFacts = [
      params.topic,
      params.objective,
      params.context,
      this.readStringField(existingScenario, 'background'),
      this.readStringField(existingScenario, 'context'),
      this.readStringField(existingScenario, 'objective'),
    ]
      .filter((value): value is string => typeof value === 'string')
      .join('\n');

    if (meetingFacts) {
      hints.brief = meetingFacts;
    }

    return hints;
  }

  private buildSessionConfigFromScenario(params: {
    sessionName: string;
    topic: string;
    aiRole: string;
    userRole: string;
    tone?: string;
    difficulty?: string;
    scenarioName: string;
    scenarioDescription?: string;
    scenarioConfig: Record<string, unknown>;
    existingConfig?: Record<string, unknown>;
    calendarEventId?: string;
    calendarProvider?: string;
  }): Record<string, unknown> {
    const existing = params.existingConfig ?? {};
    const scenarioConfig = params.scenarioConfig;
    const roles = this.readRecordField(scenarioConfig, 'roles') ?? {};
    const rawScenarioAiRole =
      this.readStringField(roles, 'assistant') ??
      this.readStringField(roles, 'ai') ??
      params.aiRole;
    const scenarioUserRole =
      this.readStringField(roles, 'user') ??
      this.readStringField(roles, 'client') ??
      params.userRole;
    const background =
      this.readStringField(scenarioConfig, 'background') ??
      this.readStringField(scenarioConfig, 'context');
    const constraints = this.toStringArray(
      this.readField(scenarioConfig, 'constraints'),
    );
    const existingCounterpart =
      this.readRecordField(existing, 'counterpartProfile') ?? {};
    const counterpartObjections = this.toStringArray(
      this.readField(existingCounterpart, 'objections'),
    );
    const scenarioAiRole = this.refineSessionAiRole({
      aiRole: rawScenarioAiRole,
      topic: params.topic,
      objective:
        this.readStringField(scenarioConfig, 'objective') ??
        this.readStringField(existing, 'objective'),
      context:
        background ??
        this.readStringField(scenarioConfig, 'description') ??
        params.scenarioDescription,
    });
    const counterpartProfile: Record<string, unknown> = {
      ...existingCounterpart,
      name:
        this.readStringField(existingCounterpart, 'name') ??
        scenarioAiRole ??
        'AI counterpart',
      role:
        this.readStringField(existingCounterpart, 'role') ??
        scenarioAiRole ??
        'Counterpart',
      tone:
        this.readStringField(existingCounterpart, 'tone') ??
        params.tone ??
        'professional',
      ...(background ? { background } : {}),
      personality:
        this.readStringField(existingCounterpart, 'personality') ??
        'Professional, realistic, and focused on the meeting outcome.',
      objections:
        counterpartObjections.length > 0
          ? counterpartObjections
          : constraints.slice(0, 3),
      signatureTraits:
        this.toStringArray(
          this.readField(existingCounterpart, 'signatureTraits'),
        ).length > 0
          ? this.toStringArray(
              this.readField(existingCounterpart, 'signatureTraits'),
            )
          : ['Asks for specifics', 'Wants a clear next step'],
    };
    const durationMinutes =
      this.readNumberField(scenarioConfig, 'durationMinutes') ??
      this.readNumberField(existing, 'durationMinutes') ??
      20;
    const difficultyValue = this.mapDifficultyLabel(
      params.difficulty ??
        this.readStringField(existing, 'difficulty') ??
        this.readStringField(scenarioConfig, 'difficulty'),
    );

    const sessionConfig: Record<string, unknown> = {
      ...existing,
      aiRole: scenarioAiRole,
      userRole: scenarioUserRole,
      description:
        params.scenarioDescription ??
        this.readStringField(existing, 'description') ??
        `Practice session: ${params.topic}`,
      scenario: {
        ...scenarioConfig,
        name: params.scenarioName,
        topic: params.topic,
        description:
          params.scenarioDescription ??
          this.readStringField(scenarioConfig, 'description') ??
          `Practice session: ${params.topic}`,
        roles: {
          ...roles,
          assistant: scenarioAiRole,
          ai: scenarioAiRole,
          counterpart: scenarioAiRole,
          user: scenarioUserRole,
          client: scenarioUserRole,
          pitcher: scenarioUserRole,
        },
      },
      counterpartProfile,
      llm: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 4096,
      },
      tone:
        params.tone ?? this.readStringField(existing, 'tone') ?? 'professional',
      difficulty: difficultyValue,
      durationMinutes,
      speechPace:
        this.readStringField(existing, 'speechPace') ?? 'conversational',
      responseLength:
        this.readStringField(existing, 'responseLength') ?? 'balanced',
      patience: this.readStringField(existing, 'patience') ?? 'medium',
      initiative: this.readStringField(existing, 'initiative') ?? 'balanced',
      language:
        this.readStringField(scenarioConfig, 'language') ??
        this.readStringField(existing, 'language') ??
        'en-US',
    };

    if (params.calendarEventId) {
      sessionConfig.calendarEventId = params.calendarEventId;
      sessionConfig.calendarProvider = params.calendarProvider ?? 'google';
    } else if (this.readStringField(existing, 'calendarEventId')) {
      sessionConfig.calendarEventId = this.readStringField(
        existing,
        'calendarEventId',
      );
      sessionConfig.calendarProvider =
        this.readStringField(existing, 'calendarProvider') ?? 'google';
    }

    return sessionConfig;
  }

  private mapDifficultyLabel(difficulty?: string): number {
    const difficultyScale: Record<string, number> = {
      'warm-up': 2,
      easy: 2,
      focused: 5,
      medium: 5,
      challenging: 7,
      hard: 7,
      elite: 9,
      expert: 9,
    };
    return difficultyScale[difficulty?.toLowerCase() ?? 'focused'] ?? 5;
  }

  private refineSessionAiRole(params: {
    aiRole: string;
    topic: string;
    objective?: string;
    context?: string;
  }): string {
    const normalizedRole = params.aiRole.trim().toLowerCase();
    if (
      normalizedRole !== 'professional counterpart' &&
      normalizedRole !== 'cross-functional meeting counterpart'
    ) {
      return params.aiRole;
    }

    const source =
      `${params.topic} ${params.objective ?? ''} ${params.context ?? ''}`.toLowerCase();
    const topic = params.topic.trim();

    if (
      /(client|customer|buyer|prospect|stakeholder|decision|evaluation|evaluate|deal|presentation|pitch|demo|proposal)/.test(
        source,
      )
    ) {
      if (
        /(engineering|developer|development|technical|integration|workflow|architecture|security|software)/.test(
          source,
        )
      ) {
        return topic
          ? `Technical stakeholder evaluating ${topic}`
          : 'Technical stakeholder evaluating the proposal';
      }

      return topic
        ? `Business stakeholder evaluating ${topic}`
        : 'Business stakeholder evaluating the proposal';
    }

    if (/(interview|candidate|hiring|role)/.test(source)) {
      return 'Hiring manager evaluating the candidate';
    }

    return params.aiRole;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private readField(value: unknown, key: string): unknown {
    if (!this.isRecord(value)) {
      return;
    }

    return value[key];
  }

  private readStringField(value: unknown, key: string): string | undefined {
    if (!this.isRecord(value)) {
      return;
    }

    const field = value[key];
    return typeof field === 'string' ? field : undefined;
  }

  private readRecordField(
    value: unknown,
    key: string,
  ): Record<string, unknown> | undefined {
    if (!this.isRecord(value)) {
      return;
    }

    const field = value[key];
    return this.isRecord(field) ? field : undefined;
  }

  private readNumberField(value: unknown, key: string): number | undefined {
    if (!this.isRecord(value)) {
      return;
    }

    const field = value[key];
    return typeof field === 'number' && Number.isFinite(field)
      ? field
      : undefined;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((entry) =>
      typeof entry === 'string' && entry.trim().length > 0
        ? [entry.trim()]
        : [],
    );
  }

  private toTeamList(value: unknown): TeamSummary[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((team) => {
      const id = this.readStringField(team, 'id');
      return id ? [{ id }] : [];
    });
  }

  private toPersonaList(value: unknown): PersonaSummary[] {
    const candidateList =
      this.readRecordField(value, 'personas') ??
      (Array.isArray(value) ? value : []);

    if (!Array.isArray(candidateList)) {
      return [];
    }

    return candidateList.flatMap((persona) => {
      const id = this.readStringField(persona, 'id');
      const name = this.readStringField(persona, 'name');
      return id && name ? [{ id, name }] : [];
    });
  }
}
