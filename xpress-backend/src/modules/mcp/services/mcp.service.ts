import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { McpClientService } from './mcp-client.service';
import { McpHistoryService } from './mcp-history.service';

@Injectable()
export class McpService {
  private openai: OpenAI;
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly mcpClientService: McpClientService,
    private readonly mcpHistoryService: McpHistoryService,
  ) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Xpress Backend MCP',
      },
    });
  }

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
      const messages: ChatCompletionMessageParam[] = [];
      if (fileUrl) {
        messages.push({
          role: 'system',
          content: `Người dùng vừa upload file tại URL: ${fileUrl}. Hãy xử lý file này bằng công cụ nếu cần.`,
        });
      }

      // Đảm bảo message không bị rỗng
      const userMessage = message?.trim() || 'Xin chào';
      messages.push({ role: 'user', content: userMessage });

      const response = await this.mcpClientService.listTools();
      const mcpTools = response.tools;
      const openaiTools: ChatCompletionTool[] = mcpTools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      }));

      this.logger.log(`Calling LLM API (OpenRouter) to decide actions...`);
      // 1. Gọi LLM qua OpenRouter
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || 'openrouter/free',
        messages: messages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      const responseMessage = completion.choices[0].message;
      this.logger.log(
        `Received answer from LLM. Tool calls present: ${!!responseMessage.tool_calls}`,
      );

      // 2. Chạy tool nếu có
      if (responseMessage.tool_calls) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        messages.push(responseMessage as any);

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(
            toolCall.function.arguments,
          ) as Record<string, unknown>;

          this.logger.log(
            `Executing MCP Tool: [${functionName}] with args:`,
            functionArgs,
          );

          const mcpResult = await this.mcpClientService.callTool(
            functionName,
            functionArgs,
          );

          this.logger.log(
            `MCP Tool execution finished. Calling LLM again with results...`,
          );

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

        // 3. Gửi kết quả lại cho LLM
        const secondResponse = await this.openai.chat.completions.create({
          model: process.env.OPENROUTER_MODEL || 'openrouter/free',
          messages: messages,
        });

        this.logger.log(
          `Received final answer from LLM combined with Tool results.`,
        );
        const finalReply = secondResponse.choices[0].message.content || '';
        if (userId) {
          await this.mcpHistoryService.saveMessage(
            'AI_ASSISTANT',
            userId,
            finalReply,
            userId,
          );
        }
        return { reply: finalReply };
      }

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
