import { Test, TestingModule } from '@nestjs/testing';
import { PlatformService } from '../../platform/platform.service';
import { PlatformRepository } from '../../platform/platform.repository';

const mockRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByConsumerKey: jest.fn(),
  findByIssuerAndClientId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('PlatformService', () => {
  let service: PlatformService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformService,
        { provide: PlatformRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PlatformService>(PlatformService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create delegates to repo.create', async () => {
    const dto = { name: 'Test' } as any;
    mockRepo.create.mockResolvedValue({ id: '1', name: 'Test' });

    const result = await service.create(dto);

    expect(mockRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('findAll delegates to repo.findAll', async () => {
    mockRepo.findAll.mockResolvedValue([]);

    const result = await service.findAll();

    expect(mockRepo.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('findOne delegates to repo.findById', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1' });

    const result = await service.findOne('1');

    expect(mockRepo.findById).toHaveBeenCalledWith('1');
    expect(result).toEqual({ id: '1' });
  });

  it('findByConsumerKey delegates to repo.findByConsumerKey', async () => {
    mockRepo.findByConsumerKey.mockResolvedValue({ id: '1' });

    await service.findByConsumerKey('key-123');

    expect(mockRepo.findByConsumerKey).toHaveBeenCalledWith('key-123');
  });

  it('findByIssuerAndClientId delegates to repo', async () => {
    mockRepo.findByIssuerAndClientId.mockResolvedValue({ id: '1' });

    await service.findByIssuerAndClientId(
      'https://iss.example.com',
      'client-1',
    );

    expect(mockRepo.findByIssuerAndClientId).toHaveBeenCalledWith(
      'https://iss.example.com',
      'client-1',
    );
  });

  it('update delegates to repo.update', async () => {
    mockRepo.update.mockResolvedValue({ id: '1', name: 'Updated' });

    await service.update('1', { name: 'Updated' });

    expect(mockRepo.update).toHaveBeenCalledWith('1', { name: 'Updated' });
  });

  it('remove delegates to repo.remove', async () => {
    mockRepo.remove.mockResolvedValue({ id: '1', isActive: false });

    await service.remove('1');

    expect(mockRepo.remove).toHaveBeenCalledWith('1');
  });
});
