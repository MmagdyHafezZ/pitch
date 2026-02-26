import { Test, TestingModule } from '@nestjs/testing';
import { LtiV1p1Controller } from '../../v1.1/controllers/lti-v1.1.controller';
import { LtiV1p1Service } from '../../v1.1/services/lti-v1.1.service';

const mockService = {
  validateLaunch: jest.fn(),
  submitGrade: jest.fn(),
};

describe('LtiV1p1Controller', () => {
  let controller: LtiV1p1Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LtiV1p1Controller],
      providers: [{ provide: LtiV1p1Service, useValue: mockService }],
    }).compile();

    controller = module.get<LtiV1p1Controller>(LtiV1p1Controller);
  });

  afterEach(() => jest.clearAllMocks());

  it('launch delegates to service.validateLaunch', async () => {
    const mockResult = { platformId: 'p1', sessionId: 's1' };
    mockService.validateLaunch.mockResolvedValue(mockResult);

    const data = {
      dto: { oauth_consumer_key: 'key', oauth_signature: 'sig' } as any,
      requestUrl: 'https://tool.example.com/lti/v1.1/launch',
      method: 'POST',
    };

    const result = await controller.launch(data);

    expect(mockService.validateLaunch).toHaveBeenCalledWith(
      data.dto,
      data.requestUrl,
      data.method,
    );
    expect(result).toEqual(mockResult);
  });

  it('grade delegates to service.submitGrade', async () => {
    mockService.submitGrade.mockResolvedValue(undefined);

    const dto = {
      consumerKey: 'key',
      sourcedId: 'sourced-1',
      outcomeServiceUrl: 'https://lms.example.com/grade',
      score: 0.9,
    } as any;

    await controller.grade(dto);

    expect(mockService.submitGrade).toHaveBeenCalledWith(dto);
  });
});
