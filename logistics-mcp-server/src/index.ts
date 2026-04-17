import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";

import { SearchService } from "./services/search.service.js";
import { DocumentService } from "./services/document.service.js";
import { IntelligenceService } from "./services/intelligence.service.js";
import { ExecutionService } from "./services/execution.service.js";
import { WebSearchService } from "./services/web-search.service.js";
import { CacheService } from "./services/cache.service.js";
import { S3Service } from "./services/s3.service.js";

// Load environment variables
dotenv.config();

/**
 * Logistics MCP Server
 * Refactored Architecture with specialized services
 */

const MONGODB_URI = process.env.MONGODB_URI || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SERPER_API_KEY = process.env.SERPER_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Services initialization
const searchService = new SearchService(MONGODB_URI, OPENROUTER_API_KEY, GEMINI_API_KEY);
const cacheService = new CacheService(searchService.getClient());
const s3Service = new S3Service();
const documentService = new DocumentService(searchService, cacheService, s3Service);
const intelligenceService = new IntelligenceService(searchService, OPENROUTER_API_KEY);
const executionService = new ExecutionService(OPENROUTER_API_KEY);
const webSearchService = new WebSearchService(SERPER_API_KEY);

const server = new McpServer({
  name: "logistics-mcp-server",
  version: "1.2.0",
});

// --- 5.1 Knowledge Tools ---

server.tool(
  "logistics_upload_document",
  "Upload, parse, and index documents into MongoDB Vector Search.",
  {
    fileUrl: z.string().url().describe("The URL of the file to upload and parse"),
    type: z.enum(["pdf", "docx", "txt"]).describe("The file format"),
    metadata: z.record(z.any()).optional().describe("Additional metadata"),
  },
  async ({ fileUrl, type, metadata }) => {
    try {
      const fullText = await documentService.parseDocument(fileUrl, type);
      const count = await documentService.indexDocument(fileUrl, type, fullText, metadata);
      return { content: [{ type: "text", text: `Success: Document indexed with ${count} chunks.` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Upload error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "logistics_search_knowledge",
  "Perform semantic search using MongoDB Vector Search.",
  {
    queryText: z.string().describe("The search query"),
    topK: z.number().optional().default(5).describe("Number of results"),
  },
  async ({ queryText, topK }) => {
    try {
      const queryVector = await searchService.getEmbedding(queryText);
      const results = await searchService.vectorSearch(queryVector, topK);
      
      const responseText = results.map((r: any, i: any) => 
        `[Result ${i+1}] Source: ${r.fileUrl}\n${r.content}`
      ).join('\n\n---\n\n');

      return { 
        content: [{ type: "text", text: responseText || "No results." }],
        structuredContent: { results }
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Search error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "logistics_ask_question",
  "Answer logistics questions using RAG.",
  { question: z.string().describe("The logistics question") },
  async ({ question }) => {
    try {
      const answer = await intelligenceService.askQuestion(question);
      return { content: [{ type: "text", text: answer }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `RAG error: ${error.message}` }], isError: true };
    }
  }
);

// --- 5.2 Web Tools ---

server.tool(
  "logistics_web_search",
  "Search external logistics information.",
  { query: z.string().describe("The search query") },
  async ({ query }) => {
    try {
      const results = await webSearchService.search(query);
      return { content: [{ type: "text", text: results }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Web search error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "logistics_summarize_topic",
  "Summarize a logistics topic.",
  { topic: z.string().describe("The logistics topic to summarize") },
  async ({ topic }) => {
    try {
      const summary = await intelligenceService.summarizeTopic(topic);
      return { content: [{ type: "text", text: summary }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Summarize error: ${error.message}` }], isError: true };
    }
  }
);

// --- 5.3 Logistics Intelligence Tools ---

server.tool(
  "logistics_analyze_flow",
  "Analyze logistics workflows using LLM.",
  { flowDescription: z.string().describe("Description of the flow") },
  async ({ flowDescription }) => {
    try {
      const analysis = await intelligenceService.analyzeFlow(flowDescription);
      return {
        content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }],
        structuredContent: analysis
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Analysis error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "logistics_recommend_solution",
  "Provide solutions for logistics problems.",
  { problem: z.string().describe("The problem description") },
  async ({ problem }) => {
    try {
      const solutions = await intelligenceService.recommendSolutions(problem);
      return { content: [{ type: "text", text: solutions }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Recommendation error: ${error.message}` }], isError: true };
    }
  }
);

// --- 5.4 Execution Tools ---

server.tool(
  "logistics_create_plan",
  "Generate operational plans.",
  {
    objective: z.string().describe("The objective"),
    constraints: z.string().optional().describe("Constraints")
  },
  async ({ objective, constraints }) => {
    try {
      const plan = await executionService.createPlan(objective, constraints);
      return { content: [{ type: "text", text: plan }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Planning error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "logistics_simulate_operation",
  "Simulate logistics scenarios.",
  { scenario: z.string().describe("The scenario") },
  async ({ scenario }) => {
    try {
      const simulation = await executionService.simulateOperation(scenario);
      return {
        content: [{ type: "text", text: JSON.stringify(simulation, null, 2) }],
        structuredContent: simulation
      };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Simulation error: ${error.message}` }], isError: true };
    }
  }
);

// --- Execution ---

async function main() {
  try {
    await searchService.connect();
    console.error("Connected to MongoDB Atlas");

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Logistics MCP Server running on stdio");
  } catch (error) {
    console.error("Initialization error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
