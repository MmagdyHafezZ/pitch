import { Test, TestingModule } from '@nestjs/testing';
import {
  HintsRepository,
  CreateHintData,
} from '../../repositories/hints.repository';
import { MongoConnectionService } from '../../services/mongo/mongo-connection.service';
import { HintStrategy, HintType } from '../../dto/hints.dto';

describe('HintsRepository', () => {
  let repository: HintsRepository;
  let mockModel: jest.Mocked<any>;
  let mongoService: jest.Mocked<MongoConnectionService>;

  const mockHintData: CreateHintData = {
    sessionId: 'session_1',
    turnId: 'turn_1',
    userId: 'user_1',
    orgId: 'org_1',
    strategy: HintStrategy.REACTIVE,
    hints: [
      {
        id: 'hint_1',
        type: HintType.NEXT_TOPIC,
        content: 'Ask about their budget.',
        rationale: 'Budget is crucial for solution design.',
        score: 0.9,
      },
    ],
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 500,
    },
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cost: 0.001,
    },
    generatedAt: new Date(),
    requestId: 'req_1',
  };

  const mockHintDocument = {
    _id: 'hint_doc_1',
    ...mockHintData,
    toObject: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    mockModel = {
      create: jest.fn(),
      findById: jest.fn().mockReturnThis(),
      find: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockReturnThis(),
      deleteOne: jest.fn().mockReturnThis(),
      deleteMany: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn(),
      exec: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HintsRepository,
        {
          provide: MongoConnectionService,
          useValue: {
            isConnected: jest.fn().mockReturnValue(true),
            waitUntilConnected: jest.fn().mockResolvedValue(true),
            getModel: jest.fn().mockReturnValue(mockModel),
          },
        },
      ],
    }).compile();

    repository = module.get<HintsRepository>(HintsRepository);
    mongoService = module.get<jest.Mocked<MongoConnectionService>>(
      MongoConnectionService,
    );
  });

  describe('create', () => {
    it('should create a hint document successfully', async () => {
      mockModel.create.mockResolvedValue(mockHintDocument as any);

      const result = await repository.create(mockHintData);

      expect(result).toBeDefined();
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: expect.any(String),
          sessionId: 'session_1',
          userId: 'user_1',
          orgId: 'org_1',
          strategy: HintStrategy.REACTIVE,
        }),
      );
    });

    it('should include all hint data in created document', async () => {
      mockModel.create.mockResolvedValue(mockHintDocument as any);

      await repository.create(mockHintData);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hints: mockHintData.hints,
          llmConfig: mockHintData.llmConfig,
          usage: mockHintData.usage,
          generatedAt: mockHintData.generatedAt,
        }),
      );
    });

    it('should throw error when MongoDB is not connected', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repository.create(mockHintData)).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });
  });

  describe('findById', () => {
    it('should find hint document by ID', async () => {
      mockModel.lean.mockResolvedValue(mockHintDocument);

      const result = await repository.findById('hint_doc_1');

      expect(result).toBeDefined();
      expect(mockModel.findById).toHaveBeenCalledWith('hint_doc_1');
      expect(mockModel.lean).toHaveBeenCalled();
    });

    it('should return null when document not found', async () => {
      mockModel.lean.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findBySessionId', () => {
    it('should find all hints for a session', async () => {
      const mockHints = [mockHintDocument, mockHintDocument];
      mockModel.lean.mockResolvedValue(mockHints);

      const result = await repository.findBySessionId('session_1');

      expect(result).toHaveLength(2);
      expect(mockModel.find).toHaveBeenCalledWith({ sessionId: 'session_1' });
      expect(mockModel.sort).toHaveBeenCalledWith({ generatedAt: -1 });
      expect(mockModel.limit).toHaveBeenCalledWith(10);
    });

    it('should respect custom limit', async () => {
      mockModel.lean.mockResolvedValue([]);

      await repository.findBySessionId('session_1', 5);

      expect(mockModel.limit).toHaveBeenCalledWith(5);
    });

    it('should return empty array when no hints found', async () => {
      mockModel.lean.mockResolvedValue([]);

      const result = await repository.findBySessionId('session_1');

      expect(result).toEqual([]);
    });
  });

  describe('findBySessionIdAndType', () => {
    it('should find hints by session and type', async () => {
      mockModel.lean.mockResolvedValue([mockHintDocument]);

      const result = await repository.findBySessionIdAndType(
        'session_1',
        HintType.NEXT_TOPIC,
      );

      expect(result).toHaveLength(1);
      expect(mockModel.find).toHaveBeenCalledWith({
        sessionId: 'session_1',
        'hints.type': HintType.NEXT_TOPIC,
      });
    });

    it('should respect limit parameter', async () => {
      mockModel.lean.mockResolvedValue([]);

      await repository.findBySessionIdAndType(
        'session_1',
        HintType.CLARIFICATION,
        20,
      );

      expect(mockModel.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('findByUserId', () => {
    it('should find hints by user ID', async () => {
      mockModel.lean.mockResolvedValue([mockHintDocument]);

      const result = await repository.findByUserId('user_1');

      expect(result).toHaveLength(1);
      expect(mockModel.find).toHaveBeenCalledWith({ userId: 'user_1' });
    });

    it('should sort by generatedAt in descending order', async () => {
      mockModel.lean.mockResolvedValue([]);

      await repository.findByUserId('user_1');

      expect(mockModel.sort).toHaveBeenCalledWith({ generatedAt: -1 });
    });
  });

  describe('findByOrgId', () => {
    it('should find hints by organization ID', async () => {
      mockModel.lean.mockResolvedValue([mockHintDocument]);

      const result = await repository.findByOrgId('org_1', 15);

      expect(result).toHaveLength(1);
      expect(mockModel.find).toHaveBeenCalledWith({ orgId: 'org_1' });
      expect(mockModel.limit).toHaveBeenCalledWith(15);
    });
  });

  describe('countBySessionId', () => {
    it('should count hints for a session', async () => {
      mockModel.exec.mockResolvedValue(5);

      const result = await repository.countBySessionId('session_1');

      expect(result).toBe(5);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        sessionId: 'session_1',
      });
    });

    it('should return 0 when no hints exist', async () => {
      mockModel.exec.mockResolvedValue(0);

      const result = await repository.countBySessionId('session_1');

      expect(result).toBe(0);
    });
  });

  describe('countBySessionIdAndType', () => {
    it('should count hints by session and type', async () => {
      mockModel.exec.mockResolvedValue(3);

      const result = await repository.countBySessionIdAndType(
        'session_1',
        HintType.FOLLOW_UP,
      );

      expect(result).toBe(3);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        sessionId: 'session_1',
        'hints.type': HintType.FOLLOW_UP,
      });
    });
  });

  describe('deleteById', () => {
    it('should delete hint document by ID', async () => {
      mockModel.exec.mockResolvedValue({ deletedCount: 1 });

      const result = await repository.deleteById('hint_doc_1');

      expect(result).toBe(true);
      expect(mockModel.deleteOne).toHaveBeenCalledWith({ _id: 'hint_doc_1' });
    });

    it('should return false when document not found', async () => {
      mockModel.exec.mockResolvedValue({ deletedCount: 0 });

      const result = await repository.deleteById('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('deleteBySessionId', () => {
    it('should delete all hints for a session', async () => {
      mockModel.exec.mockResolvedValue({ deletedCount: 5 });

      const result = await repository.deleteBySessionId('session_1');

      expect(result).toBe(5);
      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        sessionId: 'session_1',
      });
    });

    it('should return 0 when no hints deleted', async () => {
      mockModel.exec.mockResolvedValue({ deletedCount: 0 });

      const result = await repository.deleteBySessionId('session_1');

      expect(result).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should throw error when MongoDB connection fails', async () => {
      mongoService.waitUntilConnected.mockResolvedValue(false);

      await expect(repository.findBySessionId('session_1')).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('Database error');
      mockModel.create.mockRejectedValue(dbError);

      await expect(repository.create(mockHintData)).rejects.toThrow(dbError);
    });
  });
});
