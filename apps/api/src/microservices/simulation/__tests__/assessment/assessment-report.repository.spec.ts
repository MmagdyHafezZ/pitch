import { AssessmentReportRepository } from '../../assessment/repositories/assessment-report.repository';

const leanMock = jest.fn();
const findOneAndUpdateMock = jest.fn(() => ({ lean: leanMock }));
const findOneMock = jest.fn(() => ({ lean: leanMock }));

const modelMock = {
  findOneAndUpdate: findOneAndUpdateMock,
  findOne: findOneMock,
};

const waitUntilConnectedMock = jest.fn();
const getModelMock = jest.fn();

const createMongo = (connected = true) => ({
  waitUntilConnected: waitUntilConnectedMock.mockResolvedValue(connected),
  getModel: getModelMock.mockReturnValue(modelMock),
});

const sampleData = {
  runId: 'run-1',
  iterationId: 'iter-1',
  sessionMemberId: 'sm-1',
  sessionId: 'session-1',
  mode: 'final' as const,
  configVersion: 'v1',
  engineVersion: 'langgraph-v1.1',
  reportVersion: '1.0',
  report: { score: 85, breakdown: {} },
  trace: { steps: [] },
};

describe('AssessmentReportRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    waitUntilConnectedMock.mockResolvedValue(true);
    getModelMock.mockReturnValue(modelMock);
  });

  describe('upsert', () => {
    it('calls findOneAndUpdate with correct payload and options', async () => {
      const doc = { ...sampleData, _id: 'run-1' };
      leanMock.mockResolvedValue(doc);

      const mongo = createMongo();
      const repo = new AssessmentReportRepository(mongo as any);
      const result = await repo.upsert(sampleData);

      expect(waitUntilConnectedMock).toHaveBeenCalledWith(10000);
      expect(getModelMock).toHaveBeenCalled();
      expect(findOneAndUpdateMock).toHaveBeenCalledWith(
        { runId: sampleData.runId },
        expect.objectContaining({
          _id: sampleData.runId,
          runId: sampleData.runId,
          iterationId: sampleData.iterationId,
          mode: sampleData.mode,
          report: sampleData.report,
        }),
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      expect(result).toEqual(doc);
    });

    it('generates a new ObjectId for _id when runId is empty', async () => {
      const doc = { ...sampleData, runId: '', _id: 'generated-id' };
      leanMock.mockResolvedValue(doc);

      const mongo = createMongo();
      const repo = new AssessmentReportRepository(mongo as any);

      await repo.upsert({ ...sampleData, runId: '' });

      // _id should have been auto-generated (non-empty string)
      const callArg = findOneAndUpdateMock.mock.calls[0][1];
      expect(typeof callArg._id).toBe('string');
      expect(callArg._id.length).toBeGreaterThan(0);
    });

    it('throws when MongoDB is not connected', async () => {
      waitUntilConnectedMock.mockResolvedValue(false);

      const mongo = createMongo(false);
      const repo = new AssessmentReportRepository(mongo as any);

      await expect(repo.upsert(sampleData)).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });

    it('propagates model errors', async () => {
      leanMock.mockRejectedValue(new Error('write failed'));

      const mongo = createMongo();
      const repo = new AssessmentReportRepository(mongo as any);

      await expect(repo.upsert(sampleData)).rejects.toThrow('write failed');
    });

    it('handles upsert with optional fields absent', async () => {
      const minimalData = {
        runId: 'run-min',
        iterationId: 'iter-min',
        mode: 'live' as const,
        configVersion: 'v1',
        reportVersion: '1.0',
        report: {},
      };
      leanMock.mockResolvedValue({ ...minimalData, _id: 'run-min' });

      const mongo = createMongo();
      const repo = new AssessmentReportRepository(mongo as any);
      const result = await repo.upsert(minimalData);

      expect(result).toBeDefined();
      const callArg = findOneAndUpdateMock.mock.calls[0][1];
      expect(callArg.sessionMemberId).toBeUndefined();
      expect(callArg.engineVersion).toBeUndefined();
      expect(callArg.trace).toBeUndefined();
    });
  });

  describe('findByRunId', () => {
    it('returns the document when found', async () => {
      const doc = { ...sampleData, _id: 'run-1' };
      leanMock.mockResolvedValue(doc);

      const mongo = createMongo();
      const repo = new AssessmentReportRepository(mongo as any);
      const result = await repo.findByRunId('run-1');

      expect(findOneMock).toHaveBeenCalledWith({ runId: 'run-1' });
      expect(result).toEqual(doc);
    });

    it('returns null when document is not found', async () => {
      leanMock.mockResolvedValue(null);

      const mongo = createMongo();
      const repo = new AssessmentReportRepository(mongo as any);
      const result = await repo.findByRunId('not-found');

      expect(result).toBeNull();
    });

    it('throws when MongoDB is not connected', async () => {
      waitUntilConnectedMock.mockResolvedValue(false);

      const mongo = createMongo(false);
      const repo = new AssessmentReportRepository(mongo as any);

      await expect(repo.findByRunId('run-1')).rejects.toThrow(
        'MongoDB connection is not initialized',
      );
    });

    it('propagates model read errors', async () => {
      leanMock.mockRejectedValue(new Error('read failed'));

      const mongo = createMongo();
      const repo = new AssessmentReportRepository(mongo as any);

      await expect(repo.findByRunId('run-1')).rejects.toThrow('read failed');
    });
  });
});
