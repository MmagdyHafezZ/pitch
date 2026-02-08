import { Injectable } from '@nestjs/common';
import { LtiRepository } from '../repositories/lti.repository';

interface GradeData {
  userId: string;
  lineItemId: string;
  score: number;
  maxScore?: number;
  comment?: string;
  [key: string]: unknown;
}

@Injectable()
export class GradeService {
  constructor(private readonly repository: LtiRepository) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  syncGrade(_data: GradeData) {
    void _data;
    return { success: true };
  }
}
