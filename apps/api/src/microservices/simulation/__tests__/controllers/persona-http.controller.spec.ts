import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PersonaHttpController } from '../../controllers/persona-http.controller';
import { PersonaService } from '../../services/persona.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPersona = {
  id: 'persona-1',
  name: 'Alex',
  orgId: 'org-1',
  traits: { tone: 'friendly', accent: 'neutral' },
  createdAt: new Date('2024-01-01'),
};

const mockPersonaList = [mockPersona];

const mockAudio = {
  audioBuffer: Buffer.from('fake-audio-data'),
  contentType: 'audio/mpeg',
};

const mockPersonaService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  getPreviewAudio: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PersonaHttpController', () => {
  let controller: PersonaHttpController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonaHttpController],
      providers: [{ provide: PersonaService, useValue: mockPersonaService }],
    }).compile();

    controller = module.get<PersonaHttpController>(PersonaHttpController);
  });

  // -------------------------------------------------------------------------
  // createPersona
  // -------------------------------------------------------------------------
  describe('createPersona', () => {
    it('creates a persona and returns it', async () => {
      const dto = { name: 'Alex', orgId: 'org-1' } as any;
      mockPersonaService.create.mockResolvedValue(mockPersona);

      const result = await controller.createPersona(dto);

      expect(mockPersonaService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPersona);
    });

    it('propagates errors from PersonaService', async () => {
      const dto = { name: '', orgId: 'org-1' } as any;
      mockPersonaService.create.mockRejectedValue(
        new Error('Validation error'),
      );

      await expect(controller.createPersona(dto)).rejects.toThrow(
        'Validation error',
      );
    });
  });

  // -------------------------------------------------------------------------
  // listPersonas
  // -------------------------------------------------------------------------
  describe('listPersonas', () => {
    it('returns all personas when orgId is not provided', async () => {
      mockPersonaService.findAll.mockResolvedValue(mockPersonaList);

      const result = await controller.listPersonas(undefined);

      expect(mockPersonaService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockPersonaList);
    });

    it('filters personas by orgId when provided', async () => {
      mockPersonaService.findAll.mockResolvedValue(mockPersonaList);

      const result = await controller.listPersonas('org-1');

      expect(mockPersonaService.findAll).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockPersonaList);
    });

    it('returns an empty array when no personas exist', async () => {
      mockPersonaService.findAll.mockResolvedValue([]);

      const result = await controller.listPersonas('org-empty');

      expect(result).toEqual([]);
    });

    it('propagates errors from PersonaService', async () => {
      mockPersonaService.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.listPersonas('org-1')).rejects.toThrow(
        'DB error',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPersona
  // -------------------------------------------------------------------------
  describe('getPersona', () => {
    it('returns the persona for a valid id', async () => {
      mockPersonaService.findById.mockResolvedValue(mockPersona);

      const result = await controller.getPersona('persona-1');

      expect(mockPersonaService.findById).toHaveBeenCalledWith('persona-1');
      expect(result).toEqual(mockPersona);
    });

    it('propagates NotFoundException when persona is not found', async () => {
      mockPersonaService.findById.mockRejectedValue(
        new NotFoundException('Persona not found'),
      );

      await expect(controller.getPersona('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates generic errors', async () => {
      mockPersonaService.findById.mockRejectedValue(new Error('Unexpected'));

      await expect(controller.getPersona('persona-1')).rejects.toThrow(
        'Unexpected',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getPersonaPreviewAudio
  // -------------------------------------------------------------------------
  describe('getPersonaPreviewAudio', () => {
    it('streams audio when preview is available', async () => {
      mockPersonaService.getPreviewAudio.mockResolvedValue(mockAudio);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.getPersonaPreviewAudio('persona-1', mockRes);

      expect(mockPersonaService.getPreviewAudio).toHaveBeenCalledWith(
        'persona-1',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'audio/mpeg',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Length',
        mockAudio.audioBuffer.length,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, max-age=86400',
      );
      expect(mockRes.send).toHaveBeenCalledWith(mockAudio.audioBuffer);
    });

    it('throws NotFoundException when audio is null', async () => {
      mockPersonaService.getPreviewAudio.mockResolvedValue(null);

      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;

      await expect(
        controller.getPersonaPreviewAudio('persona-1', mockRes),
      ).rejects.toThrow(NotFoundException);
      expect(mockRes.send).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when audio is undefined', async () => {
      mockPersonaService.getPreviewAudio.mockResolvedValue(undefined);

      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;

      await expect(
        controller.getPersonaPreviewAudio('persona-1', mockRes),
      ).rejects.toThrow('Persona preview audio not available');
    });

    it('sets all three required headers before sending', async () => {
      mockPersonaService.getPreviewAudio.mockResolvedValue(mockAudio);

      const setHeaderCalls: string[] = [];
      const mockRes = {
        setHeader: jest.fn((name: string) => setHeaderCalls.push(name)),
        send: jest.fn(),
      } as any;

      await controller.getPersonaPreviewAudio('persona-1', mockRes);

      expect(setHeaderCalls).toContain('Content-Type');
      expect(setHeaderCalls).toContain('Content-Length');
      expect(setHeaderCalls).toContain('Cache-Control');
    });

    it('propagates errors thrown by PersonaService.getPreviewAudio', async () => {
      mockPersonaService.getPreviewAudio.mockRejectedValue(
        new Error('Storage error'),
      );

      const mockRes = { setHeader: jest.fn(), send: jest.fn() } as any;

      await expect(
        controller.getPersonaPreviewAudio('persona-1', mockRes),
      ).rejects.toThrow('Storage error');
    });
  });
});
