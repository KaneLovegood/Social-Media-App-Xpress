import { MongoClient, Collection, ServerApiVersion } from "mongodb";
import { OpenRouter } from "@openrouter/sdk";
import axios from "axios";

export class SearchService {
  private client: MongoClient;
  private openrouter: InstanceType<typeof OpenRouter>;
  public collection!: Collection; // collection points to "documents"
  private model: string;
  private geminiApiKey: string;

  constructor(mongodbUri: string, openrouterApiKey: string, geminiApiKey: string) {
    this.geminiApiKey = geminiApiKey;
    this.model = process.env.OPENROUTER_EMBEDDING_MODEL || "gemini-embedding-001";
    this.client = new MongoClient(mongodbUri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
      }
    });
    this.openrouter = new OpenRouter({
      apiKey: openrouterApiKey,
      httpReferer: 'https://github.com/OpenClaw/OpenClaw',
      appTitle: 'MCP Server for Logistics',
    });
  }

  public getClient(): MongoClient {
    return this.client;
  }

  async connect() {
    try {
      await this.client.connect();
      const database = this.client.db("logistics_db");
      this.collection = database.collection("documents");
    } catch (err) {
      // Minimal, clear error to help debugging Atlas connection issues
      console.error("Failed to connect to MongoDB Atlas:", (err as Error).message);
      throw err;
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!this.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured in .env file.");
    }
    const baseModel = this.model.includes("text-embedding-004") ? "gemini-embedding-001" : this.model.split(":")[0];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${baseModel}:embedContent?key=${this.geminiApiKey}`;
    const normalizedText = text.replace(/\s+/g, " ").trim();

    try {
      const response = await axios.post(
        apiUrl,
        {
          content: {
            parts: [{ text: normalizedText }]
          }
        },
        { headers: { "Content-Type": "application/json" } }
      );

      if (!response.data || !response.data.embedding) {
        throw new Error("Invalid response from Gemini Embedding API");
      }
      return response.data.embedding.values as number[];
    } catch (error: any) {
      console.error("Gemini Embedding error:", error.response?.data || error.message);
      throw new Error(`Gemini Embedding failed: ${error.message}`);
    }
  }

  async vectorSearch(queryVector: number[], limit: number = 5) {
    try {
      const results = await this.collection.aggregate([
        {
          "$vectorSearch": {
            "index": "vector_index",
            "path": "embedding",
            "queryVector": queryVector,
            "numCandidates": 100,
            "limit": limit
          }
        },
        {
          "$project": {
            "content": 1,
            "fileUrl": 1,
            "fileHash": 1,
            "score": { "$meta": "vectorSearchScore" },
            "metadata": 1
          }
        }
      ]).toArray();
      
      return results;
    } catch (error) {
      console.warn("Vector search failed or index not ready, falling back to empty:", error);
      return [];
    }
  }

  async keywordSearch(queryText: string, limit: number = 5) {
    // Simple regex-based fallback search if vector search is not working
    return await this.collection.find({
      content: { $regex: queryText, $options: "i" }
    }).limit(limit).toArray();
  }
}
