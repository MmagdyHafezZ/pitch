import { LtiController } from '../controllers/lti.controller';
import { LtiService } from '../services/lti.service';

describe('LtiController', () => {
  let controller: LtiController;

  beforeEach(() => {
    const service = {} as LtiService;
    controller = new LtiController(service);
  });

  describe('healthCheck', () => {
    it('returns status ok with service name', () => {
      const result = controller.healthCheck();

      expect(result).toEqual({ status: 'ok', service: 'lti' });
    });
  });
});
