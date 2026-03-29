import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { Response } from 'express';
import { SupportChatGatewayController } from '../support-chat-gateway.controller';
import { CoachStreamService } from '../coach-stream.service';
import { SUPPORT_SERVICE_PATTERNS } from '@pitch/shared-backend/interfaces/message-patterns.interface';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeClient = (): jest.Mocked<ClientProxy> =>
  ({ send: jest.fn() }) as unknown as jest.Mocked<ClientProxy>;

const makeCoachStreamService = (): jest.Mocked<CoachStreamService> =>
  ({ stream: jest.fn() }) as unknown as jest.Mocked<CoachStreamService>;

const makeRes = (): jest.Mocked<Response> & { flush?: jest.Mock } =>
  ({
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    flush: jest.fn(),
  }) as unknown as jest.Mocked<Response> & { flush?: jest.Mock };

const userClaims = { id: 'u1', email: 'u@x.com', name: 'User' };

const chatRequest = {
  messages: [{ role: 'user' as const, content: 'Hello' }],
  context: { page: '/dashboard' },
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SupportChatGatewayController', () => {
  // ── chat() ────────────────────────────────────────────────────────────────

  describe('chat()', () => {
    it('forwards the chat request to the support service and returns the response', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      client.send.mockReturnValue(of({ reply: 'Hi there!' }));

      const ctrl = new SupportChatGatewayController(client, coachStream);
      const result = await lastValueFrom(ctrl.chat(chatRequest, userClaims));

      expect(result).toEqual({ reply: 'Hi there!' });
      expect(client.send).toHaveBeenCalledWith(SUPPORT_SERVICE_PATTERNS.CHAT, {
        messages: chatRequest.messages,
        context: chatRequest.context,
        userId: userClaims.id,
      });
    });

    it('maps microservice errors to HttpException', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      client.send.mockReturnValue(throwError(() => new Error('service down')));

      const ctrl = new SupportChatGatewayController(client, coachStream);

      await expect(
        lastValueFrom(ctrl.chat(chatRequest, userClaims)),
      ).rejects.toThrow(HttpException);
    });

    it('sends userId from userClaims', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      client.send.mockReturnValue(of({ reply: 'ok' }));

      const ctrl = new SupportChatGatewayController(client, coachStream);
      await lastValueFrom(
        ctrl.chat(chatRequest, {
          id: 'special-user',
          email: 'x@y.com',
          name: 'X',
        }),
      );

      expect(client.send).toHaveBeenCalledWith(
        SUPPORT_SERVICE_PATTERNS.CHAT,
        expect.objectContaining({ userId: 'special-user' }),
      );
    });
  });

  // ── chatStream() ──────────────────────────────────────────────────────────

  describe('chatStream()', () => {
    it('sets SSE headers and flushes before streaming', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      // Return an async generator that yields nothing
      coachStream.stream.mockImplementation(async function* () {});

      const ctrl = new SupportChatGatewayController(client, coachStream);
      const res = makeRes();

      await ctrl.chatStream(chatRequest, res as unknown as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-transform',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.flushHeaders).toHaveBeenCalled();
    });

    it('writes token deltas as SSE data lines', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      coachStream.stream.mockImplementation(async function* () {
        yield 'Hello';
        yield ' World';
      });

      const ctrl = new SupportChatGatewayController(client, coachStream);
      const res = makeRes();

      await ctrl.chatStream(chatRequest, res as unknown as Response);

      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ delta: 'Hello' })}\n\n`,
      );
      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ delta: ' World' })}\n\n`,
      );
    });

    it('writes structured objects from the stream as SSE data', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      const action = {
        action: { type: 'navigate', label: 'Go home', path: '/' },
      };
      coachStream.stream.mockImplementation(async function* () {
        yield action;
      });

      const ctrl = new SupportChatGatewayController(client, coachStream);
      const res = makeRes();

      await ctrl.chatStream(chatRequest, res as unknown as Response);

      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify(action)}\n\n`,
      );
    });

    it('always writes [DONE] and calls res.end()', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      coachStream.stream.mockImplementation(async function* () {
        yield 'token';
      });

      const ctrl = new SupportChatGatewayController(client, coachStream);
      const res = makeRes();

      await ctrl.chatStream(chatRequest, res as unknown as Response);

      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('writes an error SSE event and still ends the response on generator error', async () => {
      const client = makeClient();
      const coachStream = makeCoachStreamService();
      coachStream.stream.mockImplementation(async function* () {
        throw new Error('AI exploded');
      });

      const ctrl = new SupportChatGatewayController(client, coachStream);
      const res = makeRes();

      await ctrl.chatStream(chatRequest, res as unknown as Response);

      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`,
      );
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(res.end).toHaveBeenCalled();
    });
  });
});
