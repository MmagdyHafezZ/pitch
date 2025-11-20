import { Injectable } from '@nestjs/common';
import { LtiRepository } from '../repositories/lti.repository';

interface LaunchData {
  platformId: string;
  userId: string;
  courseId?: string;
  resourceId?: string;
  [key: string]: unknown;
}

@Injectable()
export class LaunchService {
  constructor(private readonly repository: LtiRepository) {}

  handleLaunch(_data: LaunchData) {
    return { success: true };
  }
}
