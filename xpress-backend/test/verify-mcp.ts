import { Test } from '@nestjs/testing';
import { McpService } from '../src/modules/mcp/services/mcp.service';
import { McpClientService } from '../src/modules/mcp/services/mcp-client.service';
import { McpHistoryService } from '../src/modules/mcp/services/mcp-history.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function testMcpToolCalling() {
  const toolCalls: string[] = [];

  const moduleRef = await Test.createTestingModule({
    providers: [
      McpService,
      {
        provide: McpClientService,
        useFactory: () => {
          const service = new McpClientService();
          const originalCallTool = service.callTool.bind(service);
          service.callTool = async (
            name: string,
            args: Record<string, any>,
          ) => {
            toolCalls.push(name);
            console.log(`[VERIFICATION] Mocking call to tool: ${name}`);
            return originalCallTool(name, args);
          };
          return service;
        },
      },
      {
        provide: McpHistoryService,
        useValue: {
          saveMessage: async () => { },
          getHistory: async () => [],
        },
      },
    ],
  }).compile();

  const mcpService = moduleRef.get<McpService>(McpService);
  const mcpClientService = moduleRef.get<McpClientService>(McpClientService);

  // Manually init the client service
  await mcpClientService.onModuleInit();

  console.log('--- TESTING MCP TOOL CALLING ---');

  const testMessage =
    'Hãy tìm kiếm trên mạng về xu hướng logistics xanh năm 2025 và phân tích nó giúp tôi.';
  console.log(`User: ${testMessage}`);

  try {
    const result = await mcpService.chatWithMcp(undefined, testMessage);
    console.log(`AI Reply: ${result.reply}`);

    if (toolCalls.length > 0) {
      console.log(`✅ PASS: Tool calls were detected: ${toolCalls.join(', ')}`);
    } else {
      console.warn(
        "⚠️ WARNING: No tool calls detected. LLM might have answered from knowledge or the query didn't trigger a tool.",
      );
    }

    if (result.reply.includes('{') && result.reply.includes('}')) {
      console.error('❌ FAIL: JSON leakage detected in response!');
    } else {
      console.log('✅ PASS: No JSON leakage detected.');
    }
  } catch (error) {
    console.error('❌ ERROR during verification:', error);
  } finally {
    await mcpClientService.onModuleDestroy();
  }
}

testMcpToolCalling();
