import { Injectable } from '@nestjs/common';
import { LtiRepository } from '../repositories/lti.repository';

@Injectable()
export class LaunchService {
  constructor(private readonly repository: LtiRepository) {}

  async handleLaunch(data: any) {
    // LTI launch logic
    return { success: true };
  }
}
