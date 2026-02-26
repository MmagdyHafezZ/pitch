export class RetrieveDto {
  query!: string;
  namespaces!: string[];
  topK?: number;
  minScore?: number;
}

export interface RetrievedChunk {
  id: string;
  score: number;
  namespace: string;
  refType: string;
  refId: string;
  text: string;
  source?: string;
}
