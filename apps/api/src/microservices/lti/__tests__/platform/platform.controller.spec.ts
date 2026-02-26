import { Test, TestingModule } from '@nestjs/testing';
import { PlatformController } from '../../platform/platform.controller';
import { PlatformService } from '../../platform/platform.service';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('PlatformController', () => {
  let controller: PlatformController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [{ provide: PlatformService, useValue: mockService }],
    }).compile();

    controller = module.get<PlatformController>(PlatformController);
  });

  afterEach(() => jest.clearAllMocks());

  it('create calls service.create with dto', async () => {
    const dto = { name: 'Canvas', consumerKey: 'key' } as any;
    mockService.create.mockResolvedValue({ id: '1', ...dto });

    const result = await controller.create(dto);

    expect(mockService.create).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({ id: '1' });
  });

  it('findAll calls service.findAll', async () => {
    mockService.findAll.mockResolvedValue([{ id: '1' }]);

    const result = await controller.findAll();

    expect(mockService.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('findOne calls service.findOne with id', async () => {
    mockService.findOne.mockResolvedValue({ id: 'p1' });

    const result = await controller.findOne({ id: 'p1' });

    expect(mockService.findOne).toHaveBeenCalledWith('p1');
    expect(result).toEqual({ id: 'p1' });
  });

  it('update calls service.update with id and dto', async () => {
    mockService.update.mockResolvedValue({ id: 'p1', name: 'Updated' });

    await controller.update({ id: 'p1', dto: { name: 'Updated' } });

    expect(mockService.update).toHaveBeenCalledWith('p1', { name: 'Updated' });
  });

  it('remove calls service.remove with id', async () => {
    mockService.remove.mockResolvedValue({ id: 'p1', isActive: false });

    await controller.remove({ id: 'p1' });

    expect(mockService.remove).toHaveBeenCalledWith('p1');
  });
});
