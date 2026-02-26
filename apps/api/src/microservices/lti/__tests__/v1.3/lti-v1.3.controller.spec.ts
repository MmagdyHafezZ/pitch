import { Test, TestingModule } from '@nestjs/testing';
import { LtiV1p3Controller } from '../../v1.3/controllers/lti-v1.3.controller';
import { LtiV1p3Service } from '../../v1.3/services/lti-v1.3.service';
import { OidcService } from '../../v1.3/services/oidc.service';
import { JwksService } from '../../v1.3/services/jwks.service';

const mockV1p3Service = { verifyLaunch: jest.fn() };
const mockOidcService = { initiateLogin: jest.fn() };
const mockJwksService = { getToolJwks: jest.fn() };

describe('LtiV1p3Controller', () => {
  let controller: LtiV1p3Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LtiV1p3Controller],
      providers: [
        { provide: LtiV1p3Service, useValue: mockV1p3Service },
        { provide: OidcService, useValue: mockOidcService },
        { provide: JwksService, useValue: mockJwksService },
      ],
    }).compile();

    controller = module.get<LtiV1p3Controller>(LtiV1p3Controller);
  });

  afterEach(() => jest.clearAllMocks());

  it('oidcLogin delegates to oidcService.initiateLogin', async () => {
    const mockResult = {
      redirectUrl: 'https://platform.example.com/auth',
      params: {},
    };
    mockOidcService.initiateLogin.mockResolvedValue(mockResult);

    const data = {
      dto: { iss: 'https://canvas.example.com', client_id: 'abc' } as any,
      toolLaunchUrl: 'https://tool.example.com/launch',
    };

    const result = await controller.oidcLogin(data);

    expect(mockOidcService.initiateLogin).toHaveBeenCalledWith(
      data.dto,
      data.toolLaunchUrl,
    );
    expect(result).toEqual(mockResult);
  });

  it('verifyLaunch delegates to v1p3Service.verifyLaunch', async () => {
    const mockResult = { context: { sessionId: 's1' }, claims: {} };
    mockV1p3Service.verifyLaunch.mockResolvedValue(mockResult);

    const data = { idToken: 'raw.jwt.token', state: 'state-xyz' };

    const result = await controller.verifyLaunch(data);

    expect(mockV1p3Service.verifyLaunch).toHaveBeenCalledWith(
      'raw.jwt.token',
      'state-xyz',
    );
    expect(result).toEqual(mockResult);
  });

  it('getToolJwks delegates to jwksService.getToolJwks', () => {
    const mockJwks = { keys: [{ kty: 'RSA', kid: 'key-1' }] };
    mockJwksService.getToolJwks.mockReturnValue(mockJwks);

    const result = controller.getToolJwks();

    expect(mockJwksService.getToolJwks).toHaveBeenCalled();
    expect(result).toEqual(mockJwks);
  });
});
