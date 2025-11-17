import { Injectable } from '@nestjs/common';
import { LtiRepository } from '../repositories/lti.repository';

@Injectable()
export class LtiService {
  constructor(private readonly repository: LtiRepository) {}

  async healthCheck() {
    return { status: 'healthy' };
  }
}
