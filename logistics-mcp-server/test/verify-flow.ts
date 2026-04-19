import * as dotenv from "dotenv";
import { SearchService } from "../src/services/search.service.js";
import { DocumentService } from "../src/services/document.service.js";
import { CacheService } from "../src/services/cache.service.js";
import { S3Service } from "../src/services/s3.service.js";
import axios from "axios";

dotenv.config();

async function testFlow() {
  const MONGODB_URI = process.env.MONGODB_URI || "";
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

  const searchService = new SearchService(MONGODB_URI, OPENROUTER_API_KEY, GEMINI_API_KEY);
  await searchService.connect();
  console.log("Connected to MongoDB");

  const cacheService = new CacheService(searchService.getClient());
  const s3Service = new S3Service();
  const documentService = new DocumentService(searchService, cacheService, s3Service);

  const testFileUrl = "https://arxiv.org/pdf/1706.03762";
  const type = "pdf";

  console.log("--- First Pass (Parsing) ---");
  // const response = await axios.get(testFileUrl, { responseType: "arraybuffer" });
  // const fileBuffer = Buffer.from(response.data);
  // const fileName = testFileUrl.split("/").pop() || "document";
  // const fileHash = documentService.generateFileHash(fileBuffer, fileName, fileBuffer.length);
  // console.log(`Calculated File Hash: ${fileHash}`);

  // const text1 = await documentService.parseDocument(testFileUrl, type);
  // console.log("Extracted text length:", text1.length);

  // console.log("\n--- Indexing Document ---");
  // const chunkCount = await documentService.indexDocument(testFileUrl, type, text1, {
  //   fileHash: fileHash
  // });
  // console.log(`Indexed ${chunkCount} chunks.`);

  // console.log("\n--- Second Pass (Cache) ---");
  // const text2 = await documentService.parseDocument(testFileUrl, type);
  // console.log("Extracted text length:", text2.length);

  // if (text1 === text2) {
  //   console.log("\nSUCCESS: Both passes returned identical text.");

    console.log("\n--- Testing Vector Search ---");
    const query = "What is the Attention mechanism?";
    console.log(`Query: "${query}"`);

    const queryEmbedding = await searchService.getEmbedding(query);
    const results = await searchService.vectorSearch(queryEmbedding, 3);

    console.log(`Found ${results.length} relevant chunks by vector search:`);
    results.forEach((res, i) => {
      console.log(`\n[Result ${i + 1}] (Score: ${res.score.toFixed(4)})`);
      console.log(`${res.content.substring(0, 200)}...`);
    });

    if (results.length === 0) {
      console.log("\n--- Fallback: Keyword Search ---");
      const keywordResults = await searchService.keywordSearch("Attention");
      console.log(`Found ${keywordResults.length} relevant chunks by keyword:`);
      keywordResults.forEach((res, i) => {
        console.log(`\n[Keyword Result ${i + 1}]`);
        console.log(`${res.content.substring(0, 200)}...`);
      });
    }

  // } else {
  //   console.error("\nFAILURE: Text mismatch between passes.");
  // }

  process.exit(0);
}

testFlow().catch(err => {
  console.error(err);
  process.exit(1);
});
