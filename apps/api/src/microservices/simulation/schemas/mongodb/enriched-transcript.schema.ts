import { Schema, Document } from 'mongoose';

/**
 * EnrichedTranscript - MongoDB document
 *
 * Stores full transcript with embedded segments, speakers, and enrichment.
 * Referenced by Transcript.id in PostgreSQL (same ID).
 *
 * Storage: MongoDB (authoritative for detailed transcript data)
 * Reference: PostgreSQL Transcript model (stub with text/metadata)
 */

export interface ITranscriptSegment {
  _id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId?: string;
  tokens?: Array<{
    word: string;
    startMs: number;
    endMs?: number;
    confidence?: number;
  }>;
  entities?: Array<{
    type: string;
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  sentiment?: {
    score: number;
    magnitude?: number;
    label?: 'positive' | 'negative' | 'neutral';
  };
}

export interface ISpeaker {
  _id: string;
  label: string;
  diarization?: {
    provider: string;
    speakerTag: string;
    confidence?: number;
    metadata?: Record<string, any>;
  };
  role?: 'agent' | 'customer' | 'unknown';
  totalDurationMs?: number;
  segmentCount?: number;
}

export interface IEnrichment {
  summary?: string;

  topics?: Array<{
    label: string;
    confidence?: number;
    mentions?: number;
  }>;

  sentiment?: {
    overall: number;
    perSegment?: number[];
    trend?: 'improving' | 'declining' | 'stable';
  };

  entities?: {
    people?: string[];
    organizations?: string[];
    locations?: string[];
    products?: string[];
    custom?: Record<string, string[]>;
  };

  highlights?: Array<{
    type: string;
    text: string;
    startMs: number;
    endMs: number;
    importance?: number;
  }>;

  analyzedAt?: Date;
  modelVersion?: string;
  processingTimeMs?: number;
}

export interface IEnrichedTranscript extends Document {
  _id: string;
  assetId: string;
  iterationId?: string;
  sessionMemberId?: string;
  language?: string;

  segments: ITranscriptSegment[];

  speakers: ISpeaker[];

  enrichment?: IEnrichment;

  durationMs?: number;
  wordCount?: number;
  speakerCount?: number;

  createdAt: Date;
  updatedAt: Date;
}

export const EnrichedTranscriptSchema = new Schema<IEnrichedTranscript>(
  {
    _id: { type: String, required: true },
    assetId: { type: String, required: true },
    iterationId: { type: String },
    sessionMemberId: { type: String },
    language: { type: String },

    segments: [
      {
        _id: { type: String, required: true },
        startMs: { type: Number, required: true },
        endMs: { type: Number, required: true },
        text: { type: String, required: true },
        speakerId: { type: String },
        tokens: [
          {
            word: { type: String, required: true },
            startMs: { type: Number, required: true },
            endMs: { type: Number },
            confidence: { type: Number },
          },
        ],
        entities: [
          {
            type: { type: String, required: true },
            text: { type: String, required: true },
            start: { type: Number, required: true },
            end: { type: Number, required: true },
            confidence: { type: Number },
          },
        ],
        sentiment: {
          score: { type: Number },
          magnitude: { type: Number },
          label: { type: String, enum: ['positive', 'negative', 'neutral'] },
        },
      },
    ],

    speakers: [
      {
        _id: { type: String, required: true },
        label: { type: String, required: true },
        diarization: {
          provider: { type: String },
          speakerTag: { type: String },
          confidence: { type: Number },
          metadata: { type: Schema.Types.Mixed },
        },
        role: { type: String, enum: ['agent', 'customer', 'unknown'] },
        totalDurationMs: { type: Number },
        segmentCount: { type: Number },
      },
    ],

    enrichment: {
      summary: { type: String },
      topics: [
        {
          label: { type: String, required: true },
          confidence: { type: Number },
          mentions: { type: Number },
        },
      ],
      sentiment: {
        overall: { type: Number },
        perSegment: [{ type: Number }],
        trend: { type: String, enum: ['improving', 'declining', 'stable'] },
      },
      entities: {
        people: [{ type: String }],
        organizations: [{ type: String }],
        locations: [{ type: String }],
        products: [{ type: String }],
        custom: { type: Map, of: [String] },
      },
      highlights: [
        {
          type: { type: String, required: true },
          text: { type: String, required: true },
          startMs: { type: Number, required: true },
          endMs: { type: Number, required: true },
          importance: { type: Number },
        },
      ],
      analyzedAt: { type: Date },
      modelVersion: { type: String },
      processingTimeMs: { type: Number },
    },

    durationMs: { type: Number },
    wordCount: { type: Number },
    speakerCount: { type: Number },
  },
  {
    timestamps: true,
    collection: 'enrichedTranscripts',
  },
);

EnrichedTranscriptSchema.index({ assetId: 1 });
EnrichedTranscriptSchema.index({ iterationId: 1 });
EnrichedTranscriptSchema.index({ iterationId: 1, createdAt: -1 });
EnrichedTranscriptSchema.index({ sessionMemberId: 1 });
EnrichedTranscriptSchema.index({ sessionMemberId: 1, createdAt: -1 });
EnrichedTranscriptSchema.index({ 'enrichment.topics.label': 1 });
EnrichedTranscriptSchema.index({ 'enrichment.sentiment.overall': 1 });

export const EnrichedTranscriptModel = 'EnrichedTranscript';
