import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { AdminRequestLogService } from '../admin-request-log.service';
import { AdminRequestLogModel } from '../../../schemas/admin-request-log.schema';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeModel = () => {
  const leanExec = jest.fn().mockResolvedValue([]);
  const exec = jest.fn().mockResolvedValue(0);
  const limit = jest.fn().mockReturnValue({ lean: () => ({ exec: leanExec }) });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  const find = jest.fn().mockReturnValue({ sort });
  const countDocuments = jest.fn().mockReturnValue({ exec });
  const create = jest.fn().mockResolvedValue({});

  return { create, find, sort, skip, limit, leanExec, countDocuments, exec };
};

async function buildService() {
  const model = makeModel();

  const module = await Test.createTestingModule({
    providers: [
      AdminRequestLogService,
      {
        provide: getModelToken(AdminRequestLogModel, 'gateway'),
        useValue: model,
      },
    ],
  }).compile();

  return { service: module.get(AdminRequestLogService), model };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AdminRequestLogService', () => {
  // ── log() ─────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('calls model.create with entry + timestamp', async () => {
      const { service, model } = await buildService();

      const entry = {
        adminEmail: 'admin@example.com',
        method: 'GET',
        path: '/api/v1/admin/users',
        statusCode: 200,
        durationMs: 42,
      };

      await service.log(entry);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...entry,
          timestamp: expect.any(Date),
        }),
      );
    });

    it('propagates errors thrown by model.create', async () => {
      const { service, model } = await buildService();
      model.create.mockRejectedValue(new Error('db error'));

      await expect(
        service.log({
          adminEmail: 'a@x.com',
          method: 'POST',
          path: '/api/v1/admin/foo',
          statusCode: 500,
          durationMs: 10,
        }),
      ).rejects.toThrow('db error');
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns logs and total', async () => {
      const { service, model } = await buildService();

      const fakeLogs = [
        {
          adminEmail: 'a@x.com',
          method: 'GET',
          path: '/api/v1/admin/users',
          statusCode: 200,
          durationMs: 10,
          timestamp: new Date(),
        },
      ];

      model.leanExec.mockResolvedValue(fakeLogs);
      model.exec.mockResolvedValue(1);

      const result = await service.findAll(10, 0);

      expect(result.logs).toEqual(fakeLogs);
      expect(result.total).toBe(1);
    });

    it('calls find().sort().skip().limit() with the correct pagination arguments', async () => {
      const { service, model } = await buildService();
      model.leanExec.mockResolvedValue([]);
      model.exec.mockResolvedValue(0);

      await service.findAll(25, 50);

      expect(model.find).toHaveBeenCalled();
      expect(model.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(model.skip).toHaveBeenCalledWith(50);
      expect(model.limit).toHaveBeenCalledWith(25);
    });

    it('defaults to limit=50 and offset=0', async () => {
      const { service, model } = await buildService();
      model.leanExec.mockResolvedValue([]);
      model.exec.mockResolvedValue(0);

      await service.findAll();

      expect(model.skip).toHaveBeenCalledWith(0);
      expect(model.limit).toHaveBeenCalledWith(50);
    });

    it('returns an empty array and total=0 when there are no logs', async () => {
      const { service } = await buildService();

      const result = await service.findAll();

      expect(result).toEqual({ logs: [], total: 0 });
    });
  });
});
