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
   * Cuộc gọi LLM đầu tiên để phân tích ngữ cảnh và chọn Tool
   */
  async decideActions(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
  ) {
    this.logger.log(`Calling LLM API (OpenRouter) to decide actions...`);
    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b',
        messages: messages,
        tools: tools.length > 0 ? tools : undefined,
      });
      return { success: true, message: completion.choices[0].message };
    } catch (llm1Err: unknown) {
      const errMsg =
        llm1Err instanceof Error ? llm1Err.message : 'Unknown error';
      this.logger.error(`Initial LLM Call failed: ${errMsg}`);
      const httpStatus = (llm1Err as { status?: number }).status;

      let errorMessage =
        'Hệ thống AI đang quá tải (Rate Limited) hoặc gặp sự cố! Vui lòng thử lại sau giây lát.';
      if (httpStatus === 429) {
        errorMessage =
          'Hệ thống AI hiện đang xử lý quá nhiều yêu cầu (Rate Limit vượt mức cho phép của gói miễn phí). Bạn vui lòng chờ ít phút hoặc thử lại sau nhé!';
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
      const secondResponse = await this.openai.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b',
        messages: messages,
        // Bỏ tools ở lượt tổng hợp để bắt buộc model trả lời bằng chữ, không gọi thêm tool nữa
      });
      this.logger.log(
        `Received final answer from LLM combined with Tool results.`,
      );

      const replyMessage = secondResponse.choices[0].message;
      if (replyMessage.tool_calls && !replyMessage.content) {
        // Fallback nếu model vẫn kiên quyết gọi tool thì ta lấy báo lỗi, tránh lỗi missing function.name
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
        `LLM Provider (OpenRouter) failed on second turn: ${errMsg}. Fallback to Raw Tool Result.`,
      );
      const rawToolOutput = messages
        .filter((m) => m.role === 'tool')
        .map((m) => {
          const toolMsg = m as { role: string; content?: string };
          return toolMsg.content || '';
        })
        .join('\n');

      return `Hệ thống AI (Provider) phản hồi lỗi ở bước tổng hợp, nhưng công cụ thiết yếu đã hoàn tất phân tích nội dung!\n\n**Kết quả từ công cụ (Raw Output):**\n${rawToolOutput}`;
    }
  }
}
