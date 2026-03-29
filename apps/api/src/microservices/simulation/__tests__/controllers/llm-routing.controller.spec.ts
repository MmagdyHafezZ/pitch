import { LLMRoutingController } from '../../controllers/llm-routing.controller';
import { LLMRoutingConfigService } from '../../services/llm/llm-routing-config.service';
import {
  LLMRoutingConfigQueryDto,
  LLMRoutingConfigUpsertDto,
} from '../../dto/llm-routing.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(): jest.Mocked<LLMRoutingConfigService> {
  return {
    getActiveConfig: jest.fn(),
    upsertConfig: jest.fn(),
  } as unknown as jest.Mocked<LLMRoutingConfigService>;
}

const MOCK_CONFIG = {
  id: 'cfg-1',
  scope: 'global',
  config: { provider: 'openai' },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LLMRoutingController', () => {
  let controller: LLMRoutingController;
  let service: jest.Mocked<LLMRoutingConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
    controller = new LLMRoutingController(service);
  });

  // -------------------------------------------------------------------------
  // getConfig
  // -------------------------------------------------------------------------
  describe('getConfig', () => {
    it('should call getActiveConfig with the supplied payload and return the result', () => {
      const query: LLMRoutingConfigQueryDto = { scope: 'global' };
      service.getActiveConfig.mockReturnValue(MOCK_CONFIG as any);

      const result = controller.getConfig(query);

      expect(service.getActiveConfig).toHaveBeenCalledWith(query);
      expect(result).toEqual(MOCK_CONFIG);
    });

    it('should pass an empty object when payload is undefined', () => {
      service.getActiveConfig.mockReturnValue(MOCK_CONFIG as any);

      const result = controller.getConfig(undefined);

      expect(service.getActiveConfig).toHaveBeenCalledWith({});
      expect(result).toEqual(MOCK_CONFIG);
    });

    it('should pass query with orgId filter', () => {
      const query: LLMRoutingConfigQueryDto = { scope: 'org', orgId: 'org-1' };
      service.getActiveConfig.mockReturnValue(null as any);

      controller.getConfig(query);

      expect(service.getActiveConfig).toHaveBeenCalledWith({
        scope: 'org',
        orgId: 'org-1',
      });
    });

    it('should pass query with userId filter', () => {
      const query: LLMRoutingConfigQueryDto = {
        scope: 'user',
        userId: 'user-1',
      };
      service.getActiveConfig.mockReturnValue(null as any);

      controller.getConfig(query);

      expect(service.getActiveConfig).toHaveBeenCalledWith({
        scope: 'user',
        userId: 'user-1',
      });
    });

    it('should propagate errors thrown by the service', () => {
      const error = new Error('Config fetch failed');
      service.getActiveConfig.mockImplementation(() => {
        throw error;
      });

      expect(() => controller.getConfig({})).toThrow(error);
    });
  });

  // -------------------------------------------------------------------------
  // upsertConfig
  // -------------------------------------------------------------------------
  describe('upsertConfig', () => {
    const upsertDto: LLMRoutingConfigUpsertDto = {
      scope: 'global',
      config: { provider: 'openai', model: 'gpt-4o' },
      isActive: true,
      name: 'Default routing',
    };

    it('should call upsertConfig with the payload and return the result', () => {
      service.upsertConfig.mockReturnValue(MOCK_CONFIG as any);

      const result = controller.upsertConfig(upsertDto);

      expect(service.upsertConfig).toHaveBeenCalledWith(upsertDto);
      expect(result).toEqual(MOCK_CONFIG);
    });

    it('should pass org-scoped upsert correctly', () => {
      const orgDto: LLMRoutingConfigUpsertDto = {
        scope: 'org',
        orgId: 'org-2',
        config: { provider: 'watsonx' },
      };
      service.upsertConfig.mockReturnValue({ id: 'cfg-2' } as any);

      controller.upsertConfig(orgDto);

      expect(service.upsertConfig).toHaveBeenCalledWith(orgDto);
    });

    it('should propagate errors thrown by the service', () => {
      const error = new Error('Upsert failed');
      service.upsertConfig.mockImplementation(() => {
        throw error;
      });

      expect(() => controller.upsertConfig(upsertDto)).toThrow(error);
    });
  });
});
