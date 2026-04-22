import { Collection, MongoClient } from "mongodb";

export interface CacheEntry {
  fileHash: string;
  fileUrl: string;
  extractedText: string;
  parsedAt: Date;
  chunkCount: number;
  embeddingReady: boolean;
}

export class CacheService {
  private collection: Collection<CacheEntry>;

  constructor(client: MongoClient) {
    this.collection = client.db("logistics_db").collection<CacheEntry>("document_cache");
  }

  async get(fileHash: string): Promise<CacheEntry | null> {
    return await this.collection.findOne({ fileHash });
  }

  async set(fileHash: string, data: Partial<CacheEntry>): Promise<void> {
    await this.collection.updateOne(
      { fileHash },
      { 
        $set: { 
          ...data,
          parsedAt: new Date() 
        } 
      },
      { upsert: true }
    );
  }
}
