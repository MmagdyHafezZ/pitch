import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { buildSystemPrompt, type ChatContext } from './coach.prompts';
import { ALL_COACH_TOOLS } from './coach.tools';

// ─── Public types ─────────────────────────────────────────────────────────────

export type { ChatContext } from './coach.prompts';

export interface Attachment {
  name: string;
  /** text content OR data URL (data:image/…;base64,…) for images. Empty string for S3 uploads. */
  content: string;
  mimeType: string;
  size: number;
  /** Presigned S3 URL — set when the file was uploaded to S3 instead of sent inline. */
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

export type StreamItem = string | { action: UIAction };

// Convenience alias so the tools file type is not exposed in the public API.
type OpenAIMessages = Parameters<
  OpenAI['chat']['completions']['create']
>[0]['messages'];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CoachStreamService {
  private readonly logger = new Logger(CoachStreamService.name);
  private readonly openai: OpenAI;

  constructor(config: ConfigService) {
    this.openai = new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY') });
  }

  // ─── Public entry point ────────────────────────────────────────────────────

  async *stream(
    messages: ChatMessage[],
    context?: ChatContext,
  ): AsyncGenerator<StreamItem> {
    const systemPrompt = buildSystemPrompt(context);
    const openaiMessages = this.buildMessages(messages, systemPrompt);
    yield* this.runWithTools(openaiMessages);
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
  ): AsyncGenerator<StreamItem> {
    let toolName = '';
    let toolJson = '';
    let toolCallId = '';

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
      if (delta?.content) yield delta.content;
      if (delta?.tool_calls?.[0]) {
        const tc = delta.tool_calls[0];
        if (tc.id) toolCallId = tc.id;
        if (tc.function?.name) toolName = tc.function.name;
        if (tc.function?.arguments) toolJson += tc.function.arguments;
      }
    }

    if (!toolJson) return;

    // ── fetch_document: fetch content then recurse ──────────────────────────
    if (toolName === 'fetch_document') {
      let content: string;
      try {
        const { url } = JSON.parse(toolJson) as { url: string };
        content = await this.fetchDocumentContent(url);
      } catch (err) {
        this.logger.warn('fetch_document failed: %s', err);
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

      yield* this.runWithTools(updatedMessages);
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

  // ─── Message builder ───────────────────────────────────────────────────────

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
  ): OpenAIMessages {
    const result: OpenAIMessages = [{ role: 'system', content: systemPrompt }];

    for (const msg of messages) {
      if (!msg.attachments?.length) {
        result.push({ role: msg.role, content: msg.content });
        continue;
      }

      const parts: Array<{ type: string; [k: string]: unknown }> = [];
      if (msg.content) parts.push({ type: 'text', text: msg.content });

      for (const att of msg.attachments) {
        if (att.s3Url) {
          parts.unshift({
            type: 'text',
            text: `[Attached document: ${att.name} — to read it, call fetch_document with URL: ${att.s3Url}]`,
          });
        } else if (att.mimeType.startsWith('image/')) {
          parts.push({
            type: 'image_url',
            image_url: { url: att.content, detail: 'auto' },
          });
        } else {
          parts.unshift({
            type: 'text',
            text: `[Attached file: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\`\n`,
          });
        }
      }

      result.push({ role: msg.role, content: parts as unknown as string });
    }

    return result;
  }

  // ─── Document fetch ────────────────────────────────────────────────────────

  /**
   * Downloads a document from a presigned S3 URL and returns its text content.
   * PDFs are parsed with pdf-parse; all other types are decoded as UTF-8.
   */
  private async fetchDocumentContent(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? '';
    const isPdf =
      contentType.includes('pdf') ||
      url.split('?')[0].toLowerCase().endsWith('.pdf');

    if (isPdf) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (
        b: Buffer,
      ) => Promise<{ text: string }>;
      const { text } = await pdfParse(buffer);
      return text.trim();
    }

    return buffer.toString('utf-8');
  }
}
