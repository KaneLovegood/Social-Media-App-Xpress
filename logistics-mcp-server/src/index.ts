import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import * as dotenv from "dotenv";

import { SearchService } from "./services/search.service.js";
import { DocumentService } from "./services/document.service.js";
import { IntelligenceService } from "./services/intelligence.service.js";
import { ExecutionService } from "./services/execution.service.js";
import { WebSearchService } from "./services/web-search.service.js";
import { SocialService } from "./services/social.service.js";
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
const socialService = new SocialService();

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
        `[Result ${i + 1}] Source: ${r.fileUrl}\n${r.content}`
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
  "Use this tool to ask questions, retrieve information, or summarize content from previously uploaded and indexed documents. It uses Vector Search (RAG) to find internal knowledge from your files.",
  { question: z.string().describe("The logistics question or summary request for indexed documents") },
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
  "Summarize a general logistics topic using general LLM knowledge. DO NOT use this tool for summarizing specific documents you have uploaded; use 'logistics_ask_question' for that.",
  { topic: z.string().describe("The general logistics topic to summarize (not for specific files)") },
  async ({ topic }) => {
    try {
      const summary = await intelligenceService.summarizeTopic(topic);
      return { content: [{ type: "text", text: summary }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Summarize error: ${error.message}` }], isError: true };
    }
  }
);

// --- 5.3 Social Tools ---

server.tool(
  "social_search_user",
  "Tìm kiếm người dùng theo email và xem trạng thái bạn bè hiện tại giữa bạn và người đó.",
  {
    email: z.string().describe("Email của người dùng cần tìm"),
    actorUserId: z.string().describe("UserId của bạn (lấy từ system context)")
  },
  async ({ email, actorUserId }) => {
    try {
      const users = await socialService.searchUserByEmail(email, actorUserId);
      return { content: [{ type: "text", text: JSON.stringify(users, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Social search error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "social_send_friend_request",
  "Gửi lời mời kết bạn tới một người dùng cụ thể bằng targetUserId.",
  {
    actorUserId: z.string().describe("UserId của bạn (lấy từ system context)"),
    targetUserId: z.string().describe("UserId của người nhận lời mời")
  },
  async ({ actorUserId, targetUserId }) => {
    try {
      const result = await socialService.sendFriendRequest(actorUserId, targetUserId);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Send friend request error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "social_create_group",
  "Tạo một nhóm chat mới với tiêu đề (title).",
  {
    title: z.string().describe("Tên của nhóm chat mới"),
    actorUserId: z.string().describe("UserId của bạn (lấy từ system context)")
  },
  async ({ title, actorUserId }) => {
    try {
      const result = await socialService.createGroup(title, actorUserId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Create group error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "social_add_to_group",
  "Thêm một người dùng (targetUserId) vào nhóm chat (roomId).",
  {
    roomId: z.string().describe("ID của nhóm chat"),
    targetUserId: z.string().describe("UserId của người cần thêm vào"),
    actorUserId: z.string().describe("UserId của bạn (phải là ADMIN nhóm)")
  },
  async ({ roomId, targetUserId, actorUserId }) => {
    try {
      const result = await socialService.addMemberToGroup(roomId, targetUserId, actorUserId);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Add member to group error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "social_list_my_groups",
  "Liệt kê danh sách các nhóm chat mà bạn đang tham gia.",
  {
    actorUserId: z.string().describe("UserId của bạn")
  },
  async ({ actorUserId }) => {
    try {
      const groups = await socialService.listMyGroups(actorUserId);
      return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `List groups error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "social_list_friends",
  "Liệt kê danh sách bạn bè và các yêu cầu kết bạn của bạn.",
  {
    actorUserId: z.string().describe("UserId của bạn")
  },
  async ({ actorUserId }) => {
    try {
      const friends = await socialService.listFriends(actorUserId);
      return { content: [{ type: "text", text: JSON.stringify(friends, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `List friends error: ${error.message}` }], isError: true };
    }
  }
);

server.tool(
  "social_accept_reject_friend",
  "Chấp nhận hoặc từ chối một yêu cầu kết bạn.",
  {
    actorUserId: z.string().describe("UserId của bạn"),
    targetUserId: z.string().describe("UserId của người gửi lời mời"),
    action: z.enum(["ACCEPT", "REJECT"]).describe("Action cần thực hiện")
  },
  async ({ actorUserId, targetUserId, action }) => {
    try {
      const result = await socialService.handleFriendRequest(actorUserId, targetUserId, action);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Handle friend request error: ${error.message}` }], isError: true };
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
    // 1. Kết nối MongoDB
    await searchService.connect();
    console.error("Connected to MongoDB Atlas");

    // 2. Nhận diện PORT từ command line "--port <number>" hoặc từ biến môi trường
    const portIndex = process.argv.indexOf("--port");
    const port = portIndex !== -1
      ? parseInt(process.argv[portIndex + 1])
      : (process.env.PORT ? parseInt(process.env.PORT) : null);

    if (port) {
      // --- CHẾ ĐỘ 1: CHẠY TRÊN CLOUD QUA MẠNG (SSE TRANSPORT) ---
      const app = express();

      let transport: SSEServerTransport | null = null;

      // Endpoint để các AI Agent đăng ký lắng nghe sự kiện từ Server
      app.get("/sse", async (req: express.Request, res: express.Response) => {
        console.error("New AI Agent connecting via SSE...");
        transport = new SSEServerTransport("/messages", res);
        await server.connect(transport);
      });

      // Endpoint để các AI Agent gửi yêu cầu gọi Tool
      app.post("/messages", async (req: express.Request, res: express.Response) => {
        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.status(400).send("SSE transport not initialized yet");
        }
      });

      app.listen(port, () => {
        console.error(`🚀 Logistics MCP SSE Server running at http://localhost:${port}/sse`);
      });

    } else {
      // --- CHẾ ĐỘ 2: CHẠY CỤC BỘ DƯỚI LOCAL (STDIO TRANSPORT) ---
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("🔌 Logistics MCP Server running locally on stdio");
    }

  } catch (error) {
    console.error("Initialization error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
