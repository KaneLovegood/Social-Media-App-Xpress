---
name: MCP Integration & AI Assistant (Logistics Bot)
description: Comprehensive implementation and maintenance guide for the MCP-based AI Assistant in NestJS and Next.js.
---

# MCP Integration & AI Assistant (Logistics Bot) Skill

Tài liệu này cung cấp hướng dẫn toàn diện về cách thức hoạt động, kiến trúc triển khai và bảo trì hệ thống Trợ lý AI (MCP) trong hệ sinh thái `New-Technology-Xpress`.

---

## 1. Kiến trúc Tổng thể (System Architecture)

Hệ thống được chia làm 3 phần chính:
1.  **MCP Server (`logistics-mcp-server`)**: Chứa các Tool xử lý logistics (search knowledge, upload document, ask question).
2.  **Backend (`xpress-backend`)**: NestJS đóng vai trò Client kết nối với MCP Server qua `StdioClientTransport`.
3.  **Frontend (`xpress-frontend`)**: Next.js cung cấp giao diện chat và quản lý state hội thoại.

### Luồng xử lý (Execution Flow)
`User Query` -> `Frontend` -> `Backend (McpService)` -> `LLM (Decide Tool)` -> `MCP Server (Run Tool)` -> `Backend (Synthesize Result)` -> `Frontend`.

---

## 2. Chi tiết Triển khai Backend (NestJS)

### Module & Services
-   **`McpModule`**: Quản lý Dependency Injection cho toàn bộ tính năng MCP.
-   **`McpService`**: Cốt lõi logic, điều phối giữa LLM và MCP Client.
-   **`McpClientService`**: Duy trì kết nối con (Child Process) với MCP Server.
-   **`McpHistoryService`**: Lưu trữ và truy xuất lịch sử chat từ DynamoDB.
-   **`McpPromptService`**: Quản lý System Prompt và Inject Context (Lịch sử + Metadata file).

### Xử lý LLM (The LLM Loop)
Backend thực hiện vòng lặp 2 giai đoạn để đảm bảo kết quả chính xác:
1.  **Giai đoạn 1 (Decide)**: Gửi query + list tools cho LLM. LLM trả về `tool_calls`.
2.  **Giai đoạn 2 (Synthesize)**: Sau khi chạy tool, gửi kết quả ngược lại LLM (không kèm tools) để ép LLM trả về văn bản tổng hợp cuối cùng.

---

## 3. Chi tiết Triển khai Frontend (Next.js)

### Components & Hooks
-   **`useAiChat`**: React Hook quản lý toàn bộ logic: state messages, loading, upload file S3, và gọi API history.
-   **`AiChatBox`**: Giao diện hiển thị tin nhắn (Responsive), tích hợp vào `ChatContainer`.
-   **`mcp.service.ts`**: API Client để giao tiếp với các endpoint `/mcp/chat` và `/mcp/chat/history`.

### Quản lý Lịch sử (Persistence)
Tin nhắn AI không lưu ở local state mà được đồng bộ với Database:
-   Khi mount component, `useAiChat` tự động fetch lịch sử từ Backend.
-   Mọi tin nhắn (User & AI) đều được Backend lưu tự động trong table `chat_messages`.

---

## 4. Cải thiện Ngữ cảnh & Xử lý lỗi (Context & Robustness)

### Quản lý Context (Prompt Engineering)
-   **System Prompt**: Quy định chặt chẽ việc ưu tiên gọi tool `logistics_upload_document` khi có `fileUrl`.
-   **History Injection**: Mang theo 15 tin nhắn gần nhất để duy trì ngữ cảnh.
-   **File Annotation**: Các tin nhắn chứa file được chú thích rõ trạng thái (Mới hay Đã Index) để LLM biết cách xử lý.

### Xử lý lỗi JSON (Robust Parsing)
LLM đôi khi trả về JSON lỗi hoặc kèm Markdown. Backend tích hợp logic **JSON-repair**:
-   Loại bỏ Markdown blocks (```json).
-   Sử dụng RegEx để trích xuất các tham số quan trọng như `fileUrl` hoặc `queryText` khi `JSON.parse` thất bại.

---

## 5. Hướng dẫn Bảo trì (Maintenance & Troubleshooting)

### Các vấn đề thường gặp
1.  **Reply rỗng**: Do LLM cố gọi tool lần 2 ở lượt tổng hợp. 
    - *Khắc phục*: Đảm bảo đã bỏ `tools` ở lần gọi LLM thứ 2 (`synthesizeResults`).
2.  **Không nhận diện được File**: File metadata bị mất trong lịch sử.
    - *Khắc phục*: Kiểm tra `mcp-prompt.service.ts` xem đã inject `fileUrl` vào content của tin nhắn history chưa.
3.  **Lỗi Stdio Transport**: MCP Server process bị crash hoặc path sai.
    - *Khắc phục*: Kiểm tra biến môi trường `MCP_SERVER_PATH` và quyền thực thi node.

---
*Tài liệu này là kết quả của việc hợp nhất các lộ trình Backend, Frontend và Context Improvement của dự án.*
