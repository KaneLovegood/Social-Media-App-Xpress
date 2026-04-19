# Kế Hoạch Tích Hợp MCP Server vào Xpress-Backend (NestJS)

## 1. Phân tích vấn đề hiện tại
- **Mục tiêu:** Tích hợp `logistics-mcp-server` vào dự án backend hiện tại (`xpress-backend`).
- **Khác biệt về công nghệ:** Hướng dẫn trong `07-webapp-integration-guide.md` sử dụng mô hình Node.js/Express thông thường, trong khi `xpress-backend` được xây dựng bằng framework **NestJS**. Do đó, cần chuyển đổi logic từ Express sang cấu trúc module, controller, và service của NestJS (DI - Dependency Injection).
- **Yêu cầu hệ thống:** Cần giao tiếp với MCP Server dưới dạng một tiến trình con (child process) qua giao thức `stdio`, sau đó tạo Endpoint để Frontend (hoặc Client) gửi hội thoại (chat). LLM (ví dụ OpenAI) sẽ đóng vai trò quyết định gọi các Tool từ MCP Server dựa trên Context người dùng gửi lên.

## 2. Phương án giải quyết
- Đưa logic kết nối MCP (MCP Client) vào một Service chuyên biệt của NestJS.
- Tận dụng `OnModuleInit` và `OnModuleDestroy` trong NestJS lifecycle để tự động kết nối và ngắt kết nối với tiến trình MCP Server.
- Xây dựng một Module mới (ví dụ: `McpModule`) chuyên xử lý việc chat mcp, hoặc tích hợp trực tiếp vào một module AI/Chat mới tách biệt với chat thông thường giữa người - người.
- Tạo API Endpoint (vd: `POST /mcp/chat`) để Frontend gửi nội dung, trả về kết quả qua prompt LLM + Tool Call.

## 3. Đề xuất ưu tiên (Các giai đoạn)
1. **Giai đoạn 1: Chuẩn bị & Cài đặt môi trường**
   - Cài đặt các thư viện cần thiết: `@modelcontextprotocol/sdk` và `openai`.
   - Cập nhật biến môi trường (`.env`) với thông tin `OPENAI_API_KEY` và `MCP_SERVER_PATH`.
2. **Giai đoạn 2: Khởi tạo kiến trúc NestJS**
   - Tạo mới cấu trúc thư mục cho `McpModule`, `McpService`, và `McpController`.
3. **Giai đoạn 3: Hiện thực logic MCP Client & Tool Calling**
   - Triển khai logic kết nối tiến trình con bằng `StdioClientTransport`.
   - Triển khai logic OpenAI function calling (loop 2 vòng để LLM suy luận, lấy tool, gọi tool, trả kết quả lại cho LLM).
4. **Giai đoạn 4: Kiểm thử tích hợp**
   - Chạy test thử endpoint nội bộ, mô phỏng upload file/user query để xem MCP Server phản hồi.

## 4. Các file cần thay đổi & bổ sung
| File | Hành động | Mô tả |
| :--- | :--- | :--- |
| `xpress-backend/package.json` | Cập nhật | Thêm dependencies (`@modelcontextprotocol/sdk`, `openai`). |
| `xpress-backend/.env` | Thay đổi | Thêm `OPENAI_API_KEY` và `MCP_SERVER_PATH`. |
| `xpress-backend/src/app.module.ts` | Thay đổi | Đăng ký `McpModule` vào hệ thống. |
| `xpress-backend/src/modules/mcp/mcp.module.ts` | Tạo mới | Cấu hình Dependency Injection cho tính năng MCP. |
| `xpress-backend/src/modules/mcp/mcp.service.ts` | Tạo mới | Chứa logic setup `StdioClientTransport`, xử lý OpenAI Chat & Tools loop. |
| `xpress-backend/src/modules/mcp/mcp.controller.ts` | Tạo mới | Nhận request API từ client (`POST /mcp/chat`). |
| `xpress-backend/src/modules/mcp/dto/mcp-chat.dto.ts` | Tạo mới | Định dạng payload cho endpoint chat. |

## 5. Cách triển khai cụ thể

*(Đã hoàn tất lúc này)*

**Bước 1: Cài đặt packages**
Sử dụng pnpm tại thư mục `xpress-backend`:
```bash
pnpm add @modelcontextprotocol/sdk openai
```

**Bước 2: Các file đã tạo mới/sửa đổi**
- **Sửa `package.json` / `pnpm-lock.yaml`:** Chứa `@modelcontextprotocol/sdk` và `openai`.
- **Sửa `.env`:** Thêm `OPENAI_API_KEY` và `MCP_SERVER_PATH`.
- **Sửa `app.module.ts`:** Import `McpModule`.
- **Tạo `src/modules/mcp/dto/mcp-chat.dto.ts`:** DTO input `message`, `fileUrl` cho controller.
- **Tạo `src/modules/mcp/mcp.module.ts`:** Đăng ký module.
- **Tạo `src/modules/mcp/mcp.controller.ts`:** Cung cấp HTTP POST endpoint `/mcp/chat`.
- **Tạo/Fix `src/modules/mcp/mcp.service.ts`:**
  - Inject cấu hình OpenAI SDK & MCP Client logic.
  - Sử dụng Type-safe interfaces từ `openai/resources/chat/completions` (vd: `ChatCompletionMessageParam`, `ChatCompletionTool`) để giải quyết triệt để lỗi TypeScript Compilation vs Strict Lints.
  - Loại bỏ các flag/properties tools không hợp lệ (`{ capabilities: {} }`).
  
---
**Trạng thái:** Tương thích chuẩn Typescript Strict-check và NestJS DI architecture. Dự án Backend đã sẵn sàng nhận connection từ WebApp và trigger Tool lên logistics-mcp-server.