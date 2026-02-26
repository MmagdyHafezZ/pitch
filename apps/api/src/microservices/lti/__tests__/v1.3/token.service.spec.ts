import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { TokenService } from '../../v1.3/services/token.service';
import { JwksService } from '../../v1.3/services/jwks.service';

jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockJwksService = {
  signWithToolKey: jest.fn().mockReturnValue('signed.jwt.token'),
};

describe('TokenService', () => {
  let service: TokenService;

  const tokenUrl = 'https://platform.example.com/token';
  const clientId = 'client-abc';
  const scope =
    'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwksService, useValue: mockJwksService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);

    mockAxios.post = jest.fn().mockResolvedValue({
      data: {
        access_token: 'fresh-token-abc',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('fetches a new token when cache is empty', async () => {
    const token = await service.getAccessToken(tokenUrl, clientId, scope);

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(token).toBe('fresh-token-abc');
  });

  it('uses cached token on second call within TTL', async () => {
    await service.getAccessToken(tokenUrl, clientId, scope);
    const token = await service.getAccessToken(tokenUrl, clientId, scope);

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(token).toBe('fresh-token-abc');
  });

  it('fetches a fresh token when cache key differs (different scope)', async () => {
    const scope2 = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';
    mockAxios.post = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          access_token: 'token-1',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      })
      .mockResolvedValueOnce({
        data: {
          access_token: 'token-2',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      });

    const t1 = await service.getAccessToken(tokenUrl, clientId, scope);
    const t2 = await service.getAccessToken(tokenUrl, clientId, scope2);

    expect(mockAxios.post).toHaveBeenCalledTimes(2);
    expect(t1).toBe('token-1');
    expect(t2).toBe('token-2');
  });

  it('builds a client_credentials request with JWT bearer assertion', async () => {
    await service.getAccessToken(tokenUrl, clientId, scope);

    expect(mockAxios.post).toHaveBeenCalledWith(
      tokenUrl,
      expect.stringContaining('grant_type=client_credentials'),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    expect(mockJwksService.signWithToolKey).toHaveBeenCalled();
  });

  it('re-fetches when cached token is expired', async () => {
    // Force expiry by manipulating the Date mock
    const originalDateNow = Date.now;

    // First call: "now"
    // Token stored with expiresAt = now + (3600-60)*1000
    await service.getAccessToken(tokenUrl, clientId, scope + ':exp');

    // Advance time past expiry
    jest.spyOn(Date, 'now').mockImplementation(() => {
      // After initial fetch, return a time way in the future
      return originalDateNow() + 4000 * 1000;
    });

    mockAxios.post = jest.fn().mockResolvedValue({
      data: {
        access_token: 'refreshed-token',
        expires_in: 3600,
        token_type: 'Bearer',
      },
    });

    const token = await service.getAccessToken(
      tokenUrl,
      clientId,
      scope + ':exp',
    );

    expect(token).toBe('refreshed-token');
    expect(mockAxios.post).toHaveBeenCalledTimes(1);

    jest.spyOn(Date, 'now').mockRestore();
  });
});
