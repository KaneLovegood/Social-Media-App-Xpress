import { Injectable, Logger } from '@nestjs/common';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { McpHistoryService } from './mcp-history.service';

@Injectable()
export class McpPromptService {
  private readonly logger = new Logger(McpPromptService.name);

  constructor(private readonly mcpHistoryService: McpHistoryService) {}

  async buildContextMessages(
    userId: string | undefined,
    message: string,
    fileUrl?: string,
  ): Promise<ChatCompletionMessageParam[]> {
    const systemPrompt =
      'Bạn là một chuyên gia AI cao cấp chuyên về Logistics và Quản lý tài liệu.\n' +
      'PHONG CÁCH LÀM VIỆC:\n' +
      '1. LUÔN trả lời bằng TIẾNG VIỆT tự nhiên, chuyên nghiệp và chính xác.\n' +
      '2. TUYỆT ĐỐI KHÔNG sử dụng các ký tự lạ, ký tự Unicode không có nghĩa, hoặc trộn lẫn đa ngôn ngữ một cách bất thường (trừ thuật ngữ chuyên ngành tiếng Anh).\n' +
      '3. Trình bày nội dung bằng Markdown sạch sẽ, dễ đọc, sử dụng Bullet points và Tiêu đề rõ ràng.\n' +
      '\n' +
      'QUY TẮC CÔNG CỤ (MCP):\n' +
      '1. Khi người dùng gửi file (có URL), bạn BẮT BUỘC dùng tool `logistics_upload_document` để xử lý file trước.\n' +
      '2. Để trả lời câu hỏi về nội dung tài liệu, bạn BẮT BUỘC dùng tool `logistics_ask_question` hoặc `logistics_search_knowledge`. KHÔNG TỰ TRẢ LỜI dựa trên kiến thức thông thường nếu câu hỏi liên quan đến tài liệu cụ thể.\n' +
      '3. Nếu người dùng hỏi về "file này", "tài liệu vừa rồi"... hãy kiểm tra lịch sử chat để lấy URL tài liệu gần nhất.\n' +
      '\n' +
      'QUY TẮC SOCIAL & GROUP CHAT:\n' +
      '1. Tìm kiếm/Kết bạn: Dùng `social_search_user` -> Kiểm tra status -> Nếu chưa kết bạn, dùng `social_send_friend_request`.\n' +
      '2. Quản lý danh sách: Dùng `social_list_friends` để xem bạn bè/lời mời chờ. Hiển thị đủ Tên, Email, Status.\n' +
      '3. Chấp nhận/Từ chối: Dùng `social_accept_reject_friend` để duyệt lời mời.\n' +
      '4. Tạo nhóm: Hỏi tên nhóm nếu thiếu -> Dùng `social_create_group` -> Lấy roomId -> Dùng `social_add_to_group` để thêm thành viên.\n' +
      '5. Tối ưu: Nếu đã có userId từ bước search trước đó trong lịch sử, hãy dùng ngay, không gọi lại tool search.\n' +
      '\n' +
      'PHẢN HỒI & TƯƠNG TÁC:\n' +
      '- Luôn hỏi khi thiếu thông tin (email, tên nhóm, quy trình...).\n' +
      '- Xác nhận rõ ràng sau khi hoàn thành các bước quan trọng.\n' +
      '- Có thể gọi nhiều tool liên tiếp trong một lượt nếu đủ thông tin.';

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    if (userId) {
      try {
        const history = await this.mcpHistoryService.getHistory(userId);
        if (history && history.length > 0) {
          // Lấy 15 tin nhắn gần nhất và giữ đúng thứ tự thời gian (cũ -> mới)
          const recentHistory = history.slice(-15);

          for (let i = 0; i < recentHistory.length; i++) {
            const msg = recentHistory[i];
            const isCurrentMessage = i === recentHistory.length - 1;

            let msgContent = msg.message;
            if (msg.role === 'user' && msg.fileUrl) {
              if (isCurrentMessage) {
                msgContent += `\n[HỆ THỐNG: Người dùng vừa tải lên file tại URL: ${msg.fileUrl}. Bạn PHẢI gọi tool để xử lý.]`;
              } else {
                msgContent += `\n[HỆ THỐNG: Tài liệu đã tải lên trước đó tại URL: ${msg.fileUrl}.]`;
              }
            }

            messages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msgContent,
            });
          }
        }
      } catch (historyErr) {
        this.logger.error('Error loading chat history:', historyErr);
      }
    } else {
      // Fallback cho trường hợp không có userId (không có lịch sử)
      let content = message || 'Xin chào';
      if (fileUrl) {
        content += `\n[HỆ THỐNG: Người dùng vừa tải lên file tại URL: ${fileUrl}. Bạn PHẢI gọi tool để xử lý.]`;
      }
      messages.push({ role: 'user', content });
    }

    return messages;
  }
}
