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
  // Token-level timing and metadata
  tokens?: Array<{
    word: string;
    startMs: number;
    endMs?: number;
    confidence?: number;
  }>;
  // Named Entity Recognition results
  entities?: Array<{
    type: string; // PERSON, ORGANIZATION, LOCATION, etc.
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  // Segment-level sentiment
  sentiment?: {
    score: number; // -1 to 1
    magnitude?: number;
    label?: 'positive' | 'negative' | 'neutral';
  };
}

export interface ISpeaker {
  _id: string;
  label: string; // "Speaker 1", "Agent", "Customer"
  // Raw diarization output from STT provider
  diarization?: {
    provider: string; // "deepgram", "assemblyai", etc.
    speakerTag: string;
    confidence?: number;
    metadata?: Record<string, any>;
  };
  // Speaker metadata if known
  role?: 'agent' | 'customer' | 'unknown';
  totalDurationMs?: number;
  segmentCount?: number;
}

export interface IEnrichment {
  // High-level summary
  summary?: string;

  // Key topics/themes
  topics?: Array<{
    label: string;
    confidence?: number;
    mentions?: number;
  }>;

  // Overall sentiment analysis
  sentiment?: {
    overall: number; // -1 to 1
    perSegment?: number[]; // Sentiment score per segment
    trend?: 'improving' | 'declining' | 'stable';
  };

  // Named entities across entire transcript
  entities?: {
    people?: string[];
    organizations?: string[];
    locations?: string[];
    products?: string[];
    custom?: Record<string, string[]>;
  };

  // Key moments/highlights
  highlights?: Array<{
    type: string; // "objection", "closing", "question", etc.
    text: string;
    startMs: number;
    endMs: number;
    importance?: number;
  }>;

  // Analysis metadata
  analyzedAt?: Date;
  modelVersion?: string;
  processingTimeMs?: number;
}

export interface IEnrichedTranscript extends Document {
  _id: string; // Same as PostgreSQL Transcript.id (cuid)
  assetId: string;
  sessionId?: string;
  language?: string;

  // Embedded segments (denormalized)
  segments: ITranscriptSegment[];

  // Embedded speakers (denormalized)
  speakers: ISpeaker[];

  // Embedded enrichment data
  enrichment?: IEnrichment;

  // Metadata
  durationMs?: number;
  wordCount?: number;
  speakerCount?: number;

  createdAt: Date;
  updatedAt: Date;
}

export const EnrichedTranscriptSchema = new Schema<IEnrichedTranscript>(
  {
    _id: { type: String, required: true }, // Same as Postgres Transcript.id
    assetId: { type: String, required: true, index: true },
    sessionId: { type: String, index: true },
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

// Indexes for common queries
EnrichedTranscriptSchema.index({ assetId: 1 });
EnrichedTranscriptSchema.index({ sessionId: 1 });
EnrichedTranscriptSchema.index({ sessionId: 1, createdAt: -1 });
EnrichedTranscriptSchema.index({ 'enrichment.topics.label': 1 });
EnrichedTranscriptSchema.index({ 'enrichment.sentiment.overall': 1 });

export const EnrichedTranscriptModel = 'EnrichedTranscript';
