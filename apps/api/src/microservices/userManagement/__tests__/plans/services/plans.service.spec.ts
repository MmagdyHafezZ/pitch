import { ConflictException, NotFoundException } from '@nestjs/common';
import { PlanLevel } from '@prisma/user-client';
import { PlanService } from '../../../plans/services/plans.service';
import { PlanRepository } from '../../../plans/repositories/plans.repository';

describe('PlanService', () => {
  let service: PlanService;
  let repo: jest.Mocked<PlanRepository>;

  const basePlan = {
    id: 'plan-1',
    name: 'Free',
    description: 'Free tier',
    planLevel: PlanLevel.FREE,
    maxCoins: 100,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  } as any;

  beforeEach(() => {
    repo = {
      findByName: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
    } as unknown as jest.Mocked<PlanRepository>;

    service = new PlanService(repo);
  });

  it('creates a plan when name is unique', async () => {
    repo.findByName.mockResolvedValue(null);
    repo.create.mockResolvedValue(basePlan);

    const result = await service.createPlan({
      name: 'Free',
      description: 'Free tier',
      planLevel: PlanLevel.FREE,
      maxCoins: 100,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Free', isActive: true }),
    );
    expect(result).toEqual(basePlan);
  });

  it('throws conflict when creating duplicate plan name', async () => {
    repo.findByName.mockResolvedValue(basePlan);

    await expect(
      service.createPlan({
        name: 'Free',
        planLevel: PlanLevel.FREE,
        maxCoins: 100,
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('updates a plan', async () => {
    repo.findById.mockResolvedValue(basePlan);
    repo.update.mockResolvedValue({ ...basePlan, name: 'Pro' });

    const result = await service.updatePlan('plan-1', {
      name: 'Pro',
      maxCoins: 1000,
    } as any);

    expect(repo.update).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({ name: 'Pro', maxCoins: 1000 }),
    );
    expect(result.name).toBe('Pro');
  });

  it('throws not found when updating missing plan', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      service.updatePlan('missing', { name: 'Pro' }),
    ).rejects.toThrow(new NotFoundException('Plan with ID missing not found'));
  });

  it('throws conflict when renaming to another plan name', async () => {
    repo.findById.mockResolvedValue(basePlan);
    repo.findByName.mockResolvedValue({
      ...basePlan,
      id: 'plan-2',
      name: 'Pro',
    });

    await expect(service.updatePlan('plan-1', { name: 'Pro' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('deactivates a plan on remove', async () => {
    repo.findById.mockResolvedValue(basePlan);
    repo.update.mockResolvedValue({ ...basePlan, isActive: false });

    await expect(service.removePlan('plan-1')).resolves.toEqual({
      message: 'Plan with ID plan-1 has been deactivated',
    });
    expect(repo.update).toHaveBeenCalledWith('plan-1', { isActive: false });
  });

  it('throws not found when removing missing plan', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.removePlan('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('find methods delegate to repository and enforce not found on findOne', async () => {
    repo.findAll.mockResolvedValue([basePlan]);
    repo.findActive.mockResolvedValue([basePlan]);
    repo.findByName.mockResolvedValue(basePlan);
    repo.findById.mockResolvedValue(basePlan);

    await expect(service.findAll()).resolves.toEqual([basePlan]);
    await expect(service.findActive()).resolves.toEqual([basePlan]);
    await expect(service.findByName('Free')).resolves.toEqual(basePlan);
    await expect(service.findOne('plan-1')).resolves.toEqual(basePlan);

    repo.findById.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
