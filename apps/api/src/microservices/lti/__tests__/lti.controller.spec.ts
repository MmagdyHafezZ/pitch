import { Test, TestingModule } from '@nestjs/testing';
import { LtiController } from '../lti.controller';
import { DeepLinkingService } from '../advantage/deep-linking/deep-linking.service';
import { NrpsService } from '../advantage/nrps/nrps.service';
import { AgsService } from '../advantage/ags/ags.service';
import { LtiPrismaService } from '../prisma/lti-prisma.service';
import {
  createMockLtiPrismaService,
  MockLtiPrismaService,
} from './mocks/lti-prisma.service.mock';

const mockDeepLinking = { buildResponse: jest.fn() };
const mockNrps = { getMembers: jest.fn() };
const mockAgs = {
  createLineItem: jest.fn(),
  getLineItems: jest.fn(),
  submitScore: jest.fn(),
  getResults: jest.fn(),
};

describe('LtiController', () => {
  let controller: LtiController;
  let db: MockLtiPrismaService;

  beforeEach(async () => {
    db = createMockLtiPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LtiController],
      providers: [
        { provide: DeepLinkingService, useValue: mockDeepLinking },
        { provide: NrpsService, useValue: mockNrps },
        { provide: AgsService, useValue: mockAgs },
        { provide: LtiPrismaService, useValue: db },
      ],
    }).compile();

    controller = module.get<LtiController>(LtiController);
  });

  afterEach(() => jest.clearAllMocks());

  it('health returns ok status', () => {
    const result = controller.health();
    expect(result).toEqual({ status: 'ok', service: 'lti' });
  });

  it('deepLinkResponse delegates to deepLinking.buildResponse', async () => {
    const dto = { sessionId: 's1', items: [] } as any;
    mockDeepLinking.buildResponse.mockResolvedValue({
      jwt: 'jwt',
      returnUrl: 'url',
    });

    const result = await controller.deepLinkResponse(dto);

    expect(mockDeepLinking.buildResponse).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ jwt: 'jwt', returnUrl: 'url' });
  });

  it('getMembers delegates to nrps.getMembers', async () => {
    const dto = { sessionId: 's1' } as any;
    mockNrps.getMembers.mockResolvedValue([{ user_id: 'u1' }]);

    const result = await controller.getMembers(dto);

    expect(mockNrps.getMembers).toHaveBeenCalledWith(dto);
    expect(result).toHaveLength(1);
  });

  it('createLineItem delegates to ags.createLineItem', async () => {
    const dto = { sessionId: 's1', label: 'Grade', scoreMaximum: 100 } as any;
    mockAgs.createLineItem.mockResolvedValue({ id: 'li-1' });

    await controller.createLineItem(dto);

    expect(mockAgs.createLineItem).toHaveBeenCalledWith(dto);
  });

  it('getLineItems delegates to ags.getLineItems', async () => {
    mockAgs.getLineItems.mockResolvedValue([{ id: 'li-1' }]);

    const result = await controller.getLineItems({ sessionId: 's1' });

    expect(mockAgs.getLineItems).toHaveBeenCalledWith('s1');
    expect(result).toHaveLength(1);
  });

  it('submitScore delegates to ags.submitScore', async () => {
    const dto = {
      lineItemId: 'li-1',
      userId: 'u1',
      scoreGiven: 90,
      scoreMaximum: 100,
    } as any;
    mockAgs.submitScore.mockResolvedValue(undefined);

    await controller.submitScore(dto);

    expect(mockAgs.submitScore).toHaveBeenCalledWith(dto);
  });

  it('getResults delegates to ags.getResults', async () => {
    const dto = { lineItemId: 'li-1' } as any;
    mockAgs.getResults.mockResolvedValue([]);

    await controller.getResults(dto);

    expect(mockAgs.getResults).toHaveBeenCalledWith(dto);
  });

  it('findSession calls db.session.findUnique', async () => {
    db.session.findUnique.mockResolvedValue({ id: 's1', platformId: 'p1' });

    const result = await controller.findSession({ sessionId: 's1' });

    expect(db.session.findUnique).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(result).toMatchObject({ id: 's1' });
  });

  it('linkToPitch calls db.session.update with pitchSessionId and pitchUserId', async () => {
    db.session.update.mockResolvedValue({
      id: 's1',
      pitchSessionId: 'ps1',
      pitchUserId: 'pu1',
    });

    await controller.linkToPitch({
      sessionId: 's1',
      pitchSessionId: 'ps1',
      pitchUserId: 'pu1',
    });

    expect(db.session.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { pitchSessionId: 'ps1', pitchUserId: 'pu1' },
    });
  });
});
