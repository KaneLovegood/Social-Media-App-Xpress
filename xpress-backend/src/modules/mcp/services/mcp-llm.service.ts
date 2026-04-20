import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

@Injectable()
export class McpLlmService {
  private openai: OpenAI;
  private readonly logger = new Logger(McpLlmService.name);

  constructor() {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Xpress Backend MCP',
      },
    });
  }

  /**
   * Helper nội bộ để thực hiện gọi LLM với cơ chế Fallback nếu model chính lỗi
   */
  private async executeWithFallback(
    model: string,
    messages: ChatCompletionMessageParam[],
    options: {
      tools?: ChatCompletionTool[];
      temperature?: number;
      top_p?: number;
    } = {},
  ) {
    const fallbackModel = 'google/gemini-2.0-flash-001';
    const primaryModel = model || fallbackModel;

    try {
      // Thử lần 1 với model chính
      return await this.openai.chat.completions.create({
        model: primaryModel,
        messages,
        tools: options.tools,
        temperature: options.temperature,
        top_p: options.top_p,
      });
    } catch (error: unknown) {
      // Nếu đã là model dự phòng rồi mà vẫn lỗi thì throw luôn
      if (primaryModel === fallbackModel) {
        throw error;
      }

      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Primary model (${primaryModel}) failed: ${errMsg}. Retrying with fallback model (${fallbackModel})...`,
      );

      // Thử lần 2 với fallback model
      return await this.openai.chat.completions.create({
        model: fallbackModel,
        messages,
        tools: options.tools,
        temperature: options.temperature,
        top_p: options.top_p,
      });
    }
  }

  /**
   * Cuộc gọi LLM đầu tiên để phân tích ngữ cảnh và chọn Tool
   */
  async decideActions(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
  ) {
    this.logger.log(`Calling LLM API (OpenRouter) to decide actions...`);
    try {
      const completion = await this.executeWithFallback(
        process.env.OPENROUTER_MODEL || '',
        messages,
        {
          tools: tools.length > 0 ? tools : undefined,
          temperature: 0.1,
          top_p: 0.9,
        },
      );
      return { success: true, message: completion.choices[0].message };
    } catch (llm1Err: unknown) {
      const errMsg =
        llm1Err instanceof Error ? llm1Err.message : 'Unknown error';
      this.logger.error(
        `Initial LLM Call failed (including fallback): ${errMsg}`,
      );
      const httpStatus = (llm1Err as { status?: number }).status;

      let errorMessage =
        'Hệ thống AI đang quá tải hoặc gặp sự cố nghiêm trọng! Vui lòng thử lại sau giây lát.';
      if (httpStatus === 429) {
        errorMessage =
          'Hệ thống AI hiện đang xử lý quá nhiều yêu cầu. Bạn vui lòng chờ ít phút hoặc thử lại sau nhé!';
      }
      return { success: false, errorMessage };
    }
  }

  /**
   * Cuộc gọi LLM thứ hai để tổng hợp kết quả của Tool
   */
  async synthesizeResults(
    messages: ChatCompletionMessageParam[],
  ): Promise<string> {
    this.logger.log(
      `Received tool results. Calling LLM again to synthesize final answer...`,
    );
    try {
      const secondResponse = await this.executeWithFallback(
        process.env.OPENROUTER_MODEL || '',
        messages,
        {
          temperature: 0.3,
          top_p: 0.9,
        },
      );
      this.logger.log(
        `Received final answer from LLM combined with Tool results.`,
      );

      const replyMessage = secondResponse.choices[0].message;
      if (replyMessage.tool_calls && !replyMessage.content) {
        const too = replyMessage.tool_calls as any[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        const names = too.map((t) => t.function?.name || t.type).join(', ');
        return `AI tiếp tục muốn dùng công cụ ${names} nhưng không được phép ở lượt này. Vui lòng nói rõ hơn yêu cầu của bạn!`;
      }
      return replyMessage.content || '';
    } catch (llm2Err: unknown) {
      const errMsg =
        llm2Err instanceof Error ? llm2Err.message : 'Unknown error';
      this.logger.warn(
        `LLM Provider failed context synthesis (including fallback): ${errMsg}. Fallback to Raw Tool Result.`,
      );
      const rawToolOutput = messages
        .filter((m) => m.role === 'tool')
        .map((m) => {
          const toolMsg = m as { role: string; content?: string };
          return toolMsg.content || '';
        })
        .join('\n');

      return `Hệ thống AI gặp sự cố ở bước tổng hợp, nhưng công cụ thiết yếu đã hoàn tất phân tích nội dung!\n\n**Kết quả từ công cụ (Raw Output):**\n${rawToolOutput}`;
    }
  }
}
