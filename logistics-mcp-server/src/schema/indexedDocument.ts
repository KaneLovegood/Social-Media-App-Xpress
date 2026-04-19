export interface IndexedDocument {
  _id?: any;
  documentId: string;
  fileHash?: string;
  content: string;
  fileUrl?: string;
  type?: string;
  embedding: number[];
  chunkIndex: number;
  metadata: Record<string, any>;
  indexedAt: Date;
}
