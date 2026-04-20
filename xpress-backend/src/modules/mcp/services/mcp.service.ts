import { Injectable, Logger } from '@nestjs/common';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { McpClientService } from './mcp-client.service';
import { McpHistoryService } from './mcp-history.service';
import { McpLlmService } from './mcp-llm.service';
import { McpPromptService } from './mcp-prompt.service';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  constructor(
    private readonly mcpClientService: McpClientService,
    private readonly mcpHistoryService: McpHistoryService,
    private readonly mcpLlmService: McpLlmService,
    private readonly mcpPromptService: McpPromptService,
  ) {}

  async getHistory(userId: string): Promise<
    Array<{
      message: string;
      role: 'ai' | 'user';
      fileUrl?: string;
      createdAt: string;
    }>
  > {
    return this.mcpHistoryService.getHistory(userId);
  }

  async chatWithMcp(
    userId: string | undefined,
    message: string,
    fileUrl?: string,
  ) {
    // 1. Lưu tin nhắn vào DB
    if (userId) {
      this.logger.log(`Saving User Message to DB...`);
      await this.mcpHistoryService.saveMessage(
        userId,
        'AI_ASSISTANT',
        message,
        userId,
        fileUrl,
      );
    }

    try {
      // 2. Build Context Prompt với Memory Injection (Lịch sử + File)
      const messages = await this.mcpPromptService.buildContextMessages(
        userId,
        message,
        fileUrl,
      );

      // 3. Lấy danh sách tools từ MCP Server
      const response = await this.mcpClientService.listTools();
      const openaiTools: ChatCompletionTool[] = response.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      }));

      // 4. Lần 1: Gọi LLM quyết định Tool
      const llmResult = await this.mcpLlmService.decideActions(
        messages,
        openaiTools,
      );

      if (!llmResult.success) {
        return { reply: llmResult.errorMessage };
      }

      const responseMessage = llmResult.message;
      if (!responseMessage) {
        return { reply: 'Không nhận được phản hồi từ AI.' };
      }

      this.logger.log(
        `Received answer from LLM. Tool calls present: ${!!responseMessage.tool_calls}`,
      );

      // 5. Xử lý Tool nếu có
      if (responseMessage.tool_calls) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        messages.push(responseMessage as any);

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const functionName = toolCall.function.name;
          let functionArgs: Record<string, unknown>;

          try {
            let rawArgs = toolCall.function.arguments;
            const cleanArgs = rawArgs
              .replace(/,\s*([\]}])/g, '$1') // Remove trailing commas
              .replace(/^```json\s*|\s*```$/g, ''); // Remove markdown blocks

            try {
              functionArgs = JSON.parse(cleanArgs) as Record<string, unknown>;
            } catch (e1) {
              // Nếu JSON gộp nối nhiều obj nhầm lẫn như: "{...{ ... }}"
              const match = cleanArgs.match(/({[^{}]*"fileUrl"[^{}]*})/);
              if (match) {
                rawArgs = match[1];
                functionArgs = JSON.parse(rawArgs) as Record<string, unknown>;
              } else {
                const fallbackMatch = cleanArgs.match(
                  /({[^{}]*"queryText"[^{}]*})/,
                );
                if (fallbackMatch) {
                  rawArgs = fallbackMatch[1];
                  functionArgs = JSON.parse(rawArgs) as Record<string, unknown>;
                } else {
                  throw e1;
                }
              }
            }
          } catch {
            this.logger.error(
              `Failed to parse tool arguments for [${functionName}]. Raw: ${toolCall.function.arguments}`,
            );
            return {
              reply:
                'AI đã phản hồi một cấu trúc lệnh không hợp lệ. Vui lòng thử lại với câu hỏi đơn giản hơn!',
            };
          }

          this.logger.log(
            `Executing MCP Tool: [${functionName}] with args:`,
            functionArgs,
          );

          const mcpResult = await this.mcpClientService.callTool(
            functionName,
            functionArgs,
          );
          this.logger.log(`MCP Tool execution finished.`);

          const mcpContent = mcpResult.content as any[];
          const mcpTextContext =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
            mcpContent?.map((c: any) => c.text).join('\n') ||
            'Action completed';

          messages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: mcpTextContext,
          });
        }

        // Lần 2: LLM Tổng hợp
        const finalReply = await this.mcpLlmService.synthesizeResults(messages);

        if (userId && finalReply) {
          await this.mcpHistoryService.saveMessage(
            'AI_ASSISTANT',
            userId,
            finalReply,
            userId,
          );
        }
        return { reply: finalReply };
      }

      // 6. Nếu Không cần gọi Tool (Trả lời luôn)
      this.logger.log(`Received answer from LLM with NO tool calls.`);
      const reply = responseMessage.content || '';
      if (userId) {
        await this.mcpHistoryService.saveMessage(
          'AI_ASSISTANT',
          userId,
          reply,
          userId,
        );
      }
      return { reply };
    } catch (error: any) {
      this.logger.error('Error in chatWithMcp:', error);
      throw error;
    }
  }
}
