import { Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { MongoConnectionService } from '../../services/mongo/mongo-connection.service';
import {
  AssessmentReportModel,
  AssessmentReportSchema,
  type IAssessmentReport,
} from '../../schemas/mongodb';

export interface CreateAssessmentReportData {
  runId: string;
  sessionMemberId: string;
  sessionId?: string;
  mode: 'live' | 'final';
  configVersion: string;
  engineVersion?: string;
  reportVersion: string;
  report: Record<string, any>;
  trace?: Record<string, any>;
}

@Injectable()
export class AssessmentReportRepository {
  constructor(private readonly mongo: MongoConnectionService) {}

  private get model(): Model<IAssessmentReport> {
    if (!this.mongo.isConnected()) {
      throw new Error('MongoDB connection is not initialized');
    }

    return this.mongo.getModel<IAssessmentReport>(
      AssessmentReportModel,
      AssessmentReportSchema,
    );
  }

  async upsert(data: CreateAssessmentReportData): Promise<IAssessmentReport> {
    const payload = {
      _id: data.runId || new Types.ObjectId().toHexString(),
      runId: data.runId,
      sessionMemberId: data.sessionMemberId,
      sessionId: data.sessionId,
      mode: data.mode,
      configVersion: data.configVersion,
      engineVersion: data.engineVersion,
      reportVersion: data.reportVersion,
      report: data.report,
      trace: data.trace,
    };

    const doc = (await this.model
      .findOneAndUpdate({ runId: data.runId }, payload, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .lean()) as unknown as IAssessmentReport;

    return doc;
  }

  async findByRunId(runId: string): Promise<IAssessmentReport | null> {
    return (await this.model
      .findOne({ runId })
      .lean()) as unknown as IAssessmentReport | null;
  }
}
