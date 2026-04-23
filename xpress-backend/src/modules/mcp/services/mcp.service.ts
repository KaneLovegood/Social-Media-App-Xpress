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
      // 2. Xây dựng ngữ cảnh tin nhắn (System Prompt + History)
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

      this.logger.log(`Calling LLM API (OpenRouter) to decide actions...`);

      let finalReply = '';
      let iteration = 0;
      const MAX_ITERATIONS = 5;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        const completion = await this.mcpLlmService.chatCompletion(messages, {
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          temperature: 0,
        });

        const responseMessage = completion.choices[0].message;

        if (
          responseMessage.tool_calls &&
          responseMessage.tool_calls.length > 0
        ) {
          this.logger.log(
            `Iteration ${iteration}: Received ${responseMessage.tool_calls.length} tool calls.`,
          );
          messages.push(responseMessage);

          for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.type !== 'function') continue;

            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(
              toolCall.function.arguments,
            ) as Record<string, unknown>;

            this.logger.log(`Executing Tool: [${functionName}]`, functionArgs);

            try {
              const mcpResult = await this.mcpClientService.callTool(
                functionName,
                functionArgs,
              );

              const mcpContent = mcpResult.content as Array<{ text: string }>;
              const mcpTextContext =
                mcpContent?.map((c) => c.text).join('\n') ||
                'Action completed successfully.';

              messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: mcpTextContext,
              });
            } catch (error: unknown) {
              const toolError = error as Error;
              this.logger.error(
                `Error calling tool ${functionName}:`,
                toolError.message,
              );
              messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Error: ${toolError.message}`,
              });
            }
          }
          // Continue loop to give LLM a chance to process tool results and potentially call more tools
          continue;
        }

        // No more tool calls, we have the final content
        finalReply = responseMessage.content || '';
        this.logger.log(`Iteration ${iteration}: Final answer received.`);
        break;
      }

      if (iteration >= MAX_ITERATIONS) {
        this.logger.warn(
          `Reached MAX_ITERATIONS (${MAX_ITERATIONS}) in tool execution loop.`,
        );
      }

      if (userId && finalReply) {
        await this.mcpHistoryService.saveMessage(
          'AI_ASSISTANT',
          userId,
          finalReply,
          userId,
        );
      }
      return { reply: finalReply };
    } catch (error: any) {
      this.logger.error('Error in chatWithMcp:', error);
      throw error;
    }
  }
}
