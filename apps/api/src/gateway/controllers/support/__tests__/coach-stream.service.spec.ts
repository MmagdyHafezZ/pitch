import { ConfigService } from '@nestjs/config';
import {
  CoachStreamService,
  type ChatMessage,
  type StreamItem,
} from '../coach-stream.service';

jest.mock('openai', () => {
  const create = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  }));
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const OpenAIMock = require('openai') as jest.Mock;

const getCreateMock = (): jest.Mock => {
  const instance = new OpenAIMock();
  return instance.chat.completions.create;
};

function makeConfigService(overrides: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => overrides[key] ?? 'test-api-key'),
  } as unknown as ConfigService;
}

async function collectStream(
  gen: AsyncGenerator<StreamItem>,
): Promise<StreamItem[]> {
  const items: StreamItem[] = [];
  for await (const item of gen) items.push(item);
  return items;
}

async function* asyncIter<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

describe('CoachStreamService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('stream — text-only responses', () => {
    it('yields text deltas from the model', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([
          { choices: [{ delta: { content: 'Hello' } }] },
          { choices: [{ delta: { content: ' world' } }] },
        ]),
      );

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'hi' }]),
      );

      expect(items).toEqual(['Hello', ' world']);
    });

    it('ignores empty delta content', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([
          { choices: [{ delta: {} }] },
          { choices: [{ delta: { content: 'OK' } }] },
        ]),
      );

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'hi' }]),
      );

      expect(items).toEqual(['OK']);
    });
  });

  describe('stream — propose_ui_action tool call', () => {
    it('yields a structured action event', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      id: 'call_1',
                      function: {
                        name: 'propose_ui_action',
                        arguments:
                          '{"type":"navigate","label":"Go","path":"/home"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ]),
      );

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'go home' }]),
      );

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        action: { type: 'navigate', label: 'Go', path: '/home' },
      });
    });
  });

  describe('stream — generate_document tool call', () => {
    it('yields a generate_document action with title, content, format', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      id: 'call_2',
                      function: {
                        name: 'generate_document',
                        arguments:
                          '{"title":"Plan","content":"Do X","format":"pdf"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ]),
      );

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'make me a plan' }]),
      );

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        action: {
          type: 'generate_document',
          label: 'Plan',
          docContent: 'Do X',
          format: 'pdf',
        },
      });
    });

    it('defaults label to "Document" and format to "pdf" when missing', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      id: 'call_3',
                      function: {
                        name: 'generate_document',
                        arguments: '{}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ]),
      );

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'doc' }]),
      );

      expect(items).toEqual([
        {
          action: {
            type: 'generate_document',
            label: 'Document',
            docContent: '',
            format: 'pdf',
          },
        },
      ]);
    });
  });

  describe('stream — fetch_document tool call', () => {
    it('fetches the document, appends tool result, and recurses', async () => {
      const create = getCreateMock();

      create
        .mockResolvedValueOnce(
          asyncIter([
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        id: 'call_fetch',
                        function: {
                          name: 'fetch_document',
                          arguments: '{"url":"https://example.com/doc.txt"}',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ]),
        )
        .mockResolvedValueOnce(
          asyncIter([
            { choices: [{ delta: { content: 'Here is the summary.' } }] },
          ]),
        );

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('Document text')),
        headers: new Headers({ 'content-type': 'text/plain' }),
      } as unknown as Response);

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'read this' }]),
      );

      expect(fetchSpy).toHaveBeenCalledWith('https://example.com/doc.txt');
      expect(items).toEqual(['Here is the summary.']);

      const secondCallMessages = create.mock.calls[1][0].messages;
      expect(secondCallMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'tool', content: 'Document text' }),
        ]),
      );

      fetchSpy.mockRestore();
    });

    it('yields error content when fetch_document fails', async () => {
      const create = getCreateMock();

      create
        .mockResolvedValueOnce(
          asyncIter([
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        id: 'call_fetch_err',
                        function: {
                          name: 'fetch_document',
                          arguments: '{"url":"https://bad.com/fail"}',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ]),
        )
        .mockResolvedValueOnce(
          asyncIter([{ choices: [{ delta: { content: 'Sorry' } }] }]),
        );

      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('Network error'));

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'read' }]),
      );

      expect(items).toEqual(['Sorry']);

      const secondCallMessages = create.mock.calls[1][0].messages;
      const toolMsg = secondCallMessages.find((m: any) => m.role === 'tool');
      expect(toolMsg.content).toContain('Document could not be fetched');

      fetchSpy.mockRestore();
    });
  });

  describe('stream — malformed tool JSON', () => {
    it('yields fallback error string when tool JSON is invalid', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      id: 'call_bad',
                      function: {
                        name: 'propose_ui_action',
                        arguments: '{not valid json',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ]),
      );

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'test' }]),
      );

      expect(items).toHaveLength(1);
      expect(typeof items[0]).toBe('string');
      expect(items[0]).toContain("wasn't able to complete");
    });
  });

  describe('buildMessages — attachments', () => {
    it('includes S3 attachment as fetch_document instruction text', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([{ choices: [{ delta: { content: 'ok' } }] }]),
      );

      const service = new CoachStreamService(makeConfigService());
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'check this',
          attachments: [
            {
              name: 'report.pdf',
              content: '',
              mimeType: 'application/pdf',
              size: 1024,
              s3Url: 'https://s3.example.com/report.pdf',
            },
          ],
        },
      ];

      await collectStream(service.stream(messages));

      const openaiMessages = create.mock.calls[0][0].messages;
      const userMsg = openaiMessages.find((m: any) => m.role === 'user');
      const textPart = (userMsg.content as any[]).find(
        (p: any) =>
          typeof p.text === 'string' && p.text.includes('fetch_document'),
      );
      expect(textPart).toBeDefined();
      expect(textPart.text).toContain('report.pdf');
      expect(textPart.text).toContain('https://s3.example.com/report.pdf');
    });

    it('includes image attachment as image_url part', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([{ choices: [{ delta: { content: 'nice' } }] }]),
      );

      const service = new CoachStreamService(makeConfigService());
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'look at this',
          attachments: [
            {
              name: 'screenshot.png',
              content: 'data:image/png;base64,abc123',
              mimeType: 'image/png',
              size: 2048,
            },
          ],
        },
      ];

      await collectStream(service.stream(messages));

      const openaiMessages = create.mock.calls[0][0].messages;
      const userMsg = openaiMessages.find((m: any) => m.role === 'user');
      const imagePart = (userMsg.content as any[]).find(
        (p: any) => p.type === 'image_url',
      );
      expect(imagePart).toBeDefined();
      expect(imagePart.image_url.url).toBe('data:image/png;base64,abc123');
    });

    it('includes text file attachment as inline text', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([{ choices: [{ delta: { content: 'got it' } }] }]),
      );

      const service = new CoachStreamService(makeConfigService());
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'review this',
          attachments: [
            {
              name: 'notes.txt',
              content: 'Some text content',
              mimeType: 'text/plain',
              size: 100,
            },
          ],
        },
      ];

      await collectStream(service.stream(messages));

      const openaiMessages = create.mock.calls[0][0].messages;
      const userMsg = openaiMessages.find((m: any) => m.role === 'user');
      const textPart = (userMsg.content as any[]).find(
        (p: any) => typeof p.text === 'string' && p.text.includes('notes.txt'),
      );
      expect(textPart).toBeDefined();
      expect(textPart.text).toContain('Some text content');
    });

    it('sends plain messages without attachments as simple content strings', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([{ choices: [{ delta: { content: 'hi' } }] }]),
      );

      const service = new CoachStreamService(makeConfigService());
      await collectStream(service.stream([{ role: 'user', content: 'hello' }]));

      const openaiMessages = create.mock.calls[0][0].messages;
      const userMsg = openaiMessages.find((m: any) => m.role === 'user');
      expect(userMsg.content).toBe('hello');
    });
  });

  describe('stream — incremental tool call arguments', () => {
    it('accumulates tool_calls arguments across multiple chunks', async () => {
      const create = getCreateMock();
      create.mockResolvedValue(
        asyncIter([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      id: 'call_inc',
                      function: {
                        name: 'propose_ui_action',
                        arguments: '{"type":',
                      },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      function: {
                        arguments: '"navigate","label":"Go","path":"/x"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ]),
      );

      const service = new CoachStreamService(makeConfigService());
      const items = await collectStream(
        service.stream([{ role: 'user', content: 'go' }]),
      );

      expect(items).toEqual([
        { action: { type: 'navigate', label: 'Go', path: '/x' } },
      ]);
    });
  });
});
