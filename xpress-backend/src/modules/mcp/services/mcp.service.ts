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
      const systemPrompt = `Bạn là một trợ lý Logistics AI thông minh, chuyên gia cao cấp về vận tải, chuỗi cung ứng và quản lý ứng dụng Xpress.

PHẠM VI TRẢ LỜI:
- **Câu hỏi Logistics**: Bạn BẮT BUỘC trả lời mọi câu hỏi về vận chuyển, kho bãi, xu hướng ngành, quy trình logistics... 
- **Công cụ Nghiên cứu**: Nếu người dùng hỏi về thông tin mới nhất (ví dụ: xu hướng năm 2025, 2026), dữ liệu thị trường hoặc các kiến thức bạn không có sẵn, hãy sử dụng ngay công cụ 'logistics_web_search' để tìm kiếm thông tin trước khi trả lời.
- **Tính năng ứng dụng**: Hỗ trợ đầy đủ việc kết bạn, tạo nhóm, đọc tài liệu (RAG).
- **Từ chối**: Chỉ từ chối các chủ đề hoàn toàn không liên quan (ví dụ: game online, giải trí, nấu ăn...). Khi từ chối, hãy dùng mẫu: "Xin lỗi, tôi là trợ lý chuyên gia chuyên sâu về Logistics và Xpress. Chủ đề này nằm ngoài phạm vi hỗ trợ của tôi. Bạn có muốn tôi cập nhật các xu hướng logistics mới nhất hoặc giúp bạn quản lý nhóm chat không?".

QUY TẮC CÔNG CỤ (MCP):
Khi người dùng upload file hoặc gửi một URL file mới:
1. Đầu tiên, bạn PHẢI sử dụng công cụ 'logistics_upload_document' để parse và index nội dung file vào cơ sở dữ liệu.
2. Sau khi index thành công, bạn mới có thể sử dụng 'logistics_ask_question' để tìm kiếm thông tin và trả lời các câu hỏi liên quan đến nội dung file đó.
KHÔNG sử dụng 'logistics_summarize_topic' để tóm tắt các file người dùng đã upload.

Dưới đây là thông tin định danh của người dùng hiện tại (bạn):
- userId (actorUserId): ${userId}

Nếu người dùng muốn tìm kiếm người dùng khác hoặc kết bạn:
1. Sử dụng 'social_search_user' với email người dùng cung cấp và actorUserId của bạn.
2. Kiểm tra 'friendStatus' trong kết quả trả về.
3. Nếu chưa kết bạn, sử dụng 'social_send_friend_request' với actorUserId của bạn và targetUserId tìm được.
4. Bạn có thể dùng 'social_list_friends' để liệt kê toàn bộ bạn bè hoặc xem có yêu cầu kết bạn nào đang chờ không. Khi hiển thị danh sách bạn bè, bạn BẮT BUỘC phải định dạng chúng dưới dạng một Bảng Markdown (Markdown Table) thật đẹp mắt, sử dụng các cột (#, 👤 Tên, ✉️ Email, 🟢 Trạng thái) kèm emoji sinh động. Trạng thái kết bạn cần được hiển thị dưới dạng badge (Ví dụ: '● Bạn bè (FRIEND)', '● Chờ xác nhận (PENDING_RECEIVED)'), giúp giao diện chat hiển thị chuyên nghiệp và dễ đọc nhất.
5. Để chấp nhận hoặc từ chối yêu cầu kết bạn, dùng 'social_accept_reject_friend' với targetUserId và action (ACCEPT/REJECT).

Nếu người dùng muốn tạo nhóm chat hoặc thêm người vào nhóm:
- LUÔN hỏi tên nhóm (title) nếu người dùng chưa cung cấp.
- Nếu bạn đã tìm thấy userId từ bước 'social_search_user' trước đó, hãy dùng ngay userId đó cho 'social_add_to_group', KHÔNG cần gọi lại tool search nếu thông tin đã có trong lịch sử chat.
- Quy trình: Tạo nhóm mới bằng 'social_create_group' -> Lấy roomId từ kết quả -> Thêm thành viên bằng 'social_add_to_group' với roomId đó và targetUserId.
- Bạn CÓ THỂ gọi nhiều tool liên tiếp trong một lượt nếu đã đủ thông tin.
- Dùng 'social_list_my_groups' để xem danh sách nhóm hiện có của bạn.
- Khi người dùng muốn tóm tắt hoặc xem nội dung trao đổi của một nhóm chat, bạn hãy dùng 'social_get_group_transcript' với roomId và actorUserId. Sau khi nhận được transcript thô, hãy định dạng bản tóm tắt thật chuyên nghiệp bằng Markdown có cấu trúc gồm: 🎯 **Chủ đề thảo luận chính**, 🤝 **Các quyết định đã thống nhất**, và 📋 **Danh sách việc cần làm (Action Items)** kèm người chịu trách nhiệm (nếu có).

Nếu chưa đủ thông tin (ví dụ thiếu quy trình, thiếu dữ liệu để thực hiện tool, thiếu email, tên nhóm, ...), hãy trả lời hoặc đặt câu hỏi và yêu cầu người dùng cung cấp thêm một cách thân thiện.
Khi đã thực hiện xong các bước (tạo nhóm, thêm người), hãy xác nhận rõ ràng với người dùng.
Luôn trả lời bằng tiếng Việt.`;

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Load conversation history if userId is provided
      if (userId) {
        const history = await this.mcpHistoryService.getHistory(userId);
        // Take the last 10 messages to maintain relevant context without excessive tokens
        const recentHistory = history.slice(-10);

        for (const entry of recentHistory) {
          messages.push({
            role: entry.role === 'ai' ? 'assistant' : 'user',
            content: entry.message,
          });

          // If the historical message had a file, remind the AI about its context
          if (entry.fileUrl) {
            messages.push({
              role: 'system',
              content: `[Context] Bạn đã xử lý file tại URL: ${entry.fileUrl}`,
            });
          }
        }
      }

      if (fileUrl) {
        messages.push({
          role: 'system',
          content: `Người dùng vừa upload file tại URL: ${fileUrl}. Hãy sử dụng các công cụ logistics để phân tích file này nếu cần thiết.`,
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

      let finalReply = '';
      let iteration = 0;
      const MAX_ITERATIONS = 10;

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        const completion = await this.openai.chat.completions.create({
          model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
          messages: messages,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          tool_choice: 'auto',
          temperature: 0,
          max_tokens: 2048,
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

      if (iteration >= MAX_ITERATIONS && !finalReply) {
        this.logger.warn(
          `Reached MAX_ITERATIONS (${MAX_ITERATIONS}) in tool execution loop. Forcing final summary response.`,
        );
        try {
          const finalCompletion = await this.openai.chat.completions.create({
            model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
            messages: messages,
            temperature: 0,
            max_tokens: 2048,
          });
          finalReply =
            finalCompletion.choices[0].message.content ||
            'Tôi đã thực hiện xong các tác vụ.';
        } catch (err) {
          this.logger.error('Error generating final fallback reply:', err);
          finalReply = 'Tôi đã thực hiện các yêu cầu của bạn.';
        }
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
