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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleLaunch(_data: LaunchData) {
    void _data;
    return { success: true };
  }
}
