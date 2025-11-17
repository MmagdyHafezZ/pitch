import { Injectable } from '@nestjs/common';
import { LtiRepository } from '../repositories/lti.repository';

@Injectable()
export class GradeService {
  constructor(private readonly repository: LtiRepository) {}

  async syncGrade(data: any) {
    // Grade sync logic
    return { success: true };
  }
}
