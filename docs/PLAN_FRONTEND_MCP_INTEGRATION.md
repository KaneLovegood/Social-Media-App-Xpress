# Kế Hoạch Tích Hợp AI Assistant (MCP) vào Xpress-Frontend (Next.js)

## 1. Phân tích vấn đề hiện tại
- **Trạng thái Backend:** Dự án `xpress-backend` đã hoàn tất tích hợp `McpModule`, cung cấp endpoint `POST /mcp/chat` nhận payload `{ message: string, fileUrl?: string }` và trả về `{ reply: string }`.
- **Trạng thái Frontend:** `xpress-frontend` được xây dựng bằng Next.js + React. Hệ thống đã có các tính năng chat (P2P/Group) và cơ chế upload file (S3 presigned URL). Tuy nhiên, chưa có giao diện dành riêng cho việc giao tiếp với AI (Bot).
- **Mục tiêu:** Cần xây dựng một giao diện **Trợ lý mạng Logistics (AI Assistant)**. Người dùng có thể chat gửi câu hỏi, hoặc đính kèm file (PDF, DOCX) để Bot phân tích thông qua endpoint của Backend.

## 2. Phương án giải quyết
- **Tạo API service:** Viết một hàm gọi API (fetch/axios) chuyên biệt gọi tới `POST /mcp/chat`.
- **Xây dựng UI Chat Bot chuyên dụng:** Tạo một React Component độc lập (`AiChatInterface`) quản lý state tin nhắn gồm tin nhắn của `user` và tin nhắn phản hồi của `ai`, có báo hiệu trạng thái `isLoading` (typing).
- **Tận dụng logic Upload File:** Tận dụng lại hook/service upload S3 đang có của Web/App để tải file lên -> Lấy được `fileUrl` -> Nhét vào payload gửi cho Chat Bot AI.
- **Tạo Page riêng (hoặc Modal/Drawer):** Cung cấp lối vào cho tính năng này, ví dụ tạo trang `/ai-assistant` hoặc một Chat Widget nổi trên ứng dụng.

## 3. Đề xuất ưu tiên (Các giai đoạn)
1. **Giai đoạn 1: Thiết lập API Client cho MCP**
   - Viết hàm gọi API connect với Host Backend.
2. **Giai đoạn 2: Xây dựng UI Component Chatbot**
   - Dựng layout (Dùng TailwindCSS): Vùng hiển thị tin nhắn (Scrollable message list), Thanh input nhập liệu, Nút Gửi.
3. **Giai đoạn 3: Kết hợp Logic React State**
   - Quản lý lịch sử hội thoại hiển thị ở Client (Array objects: `{ role: 'user' | 'ai', text: string }`).
   - Gọi API khi nhấn Enter/Send và hiển thị trạng thái đang chờ (Skeleton/Spinner).
4. **Giai đoạn 4: Tích hợp Upload Tệp**
   - Thêm nút đính kèm (Attachment).
   - Tái sử dụng logic upload S3 lấy link URL. Gửi URL này vào API backend.

## 4. Các file đã thay đổi & bổ sung (thực tế)

| File | Hành động (thực tế) | Mô tả |
| :--- | :--- | :--- |
| `xpress-frontend/lib/services/mcp.service.ts` | Khởi tạo | API client gửi payload tới `POST /mcp/chat` (frontend → backend). |
| `xpress-frontend/types/mcp.type.ts` | Khởi tạo | Kiểu TypeScript cho các payload (McpChatMessage, request/response). |
| `xpress-frontend/hooks/useAiChat.ts` | Khởi tạo | Hook tách riêng logic: quản lý state, upload S3 (presigned), gọi API MCP, scroll, loading, clear. |
| `xpress-frontend/components/chat/AiChatBox.tsx` | Sửa đổi | Component UI của AI: chuyển từ page độc lập sang component nhúng trong `ChatContainer`; thêm prop `onBackToList` (mobile), sử dụng `useAiChat`. |
| `xpress-frontend/components/chat/ChatContainer.tsx` | Sửa đổi | Chèn một room ảo `AI_ASSISTANT` vào danh sách sidebarRooms; render `<AiChatBox />` khi activeRoomId === `AI_ASSISTANT`. |
| `xpress-frontend/app/(protected)/ai-assistant/page.tsx` | Xóa | Page độc lập đã bị xoá vì AI giờ được nhúng vào giao diện Chat P2P. |

### Những thay đổi thực tế đã thực hiện
- Tạo `hooks/useAiChat.ts` và di chuyển toàn bộ logic (state, file upload, gửi request, xử lý reply, loading) từ `AiChatBox` vào hook.
- Sửa `components/chat/AiChatBox.tsx` để sử dụng hook và chỉ còn giữ phần render (UI) — responsive để nhúng vào `ChatContainer`.
- Sửa `components/chat/ChatContainer.tsx` để:
  - Thêm một mục ảo `AI_ASSISTANT` ở đầu danh sách `sidebarRooms` (được ChatSidebar render tự động).
  - Mở rộng `effectiveActiveRoomId` để chấp nhận `AI_ASSISTANT` như một room hợp lệ.
  - Khi `effectiveActiveRoomId === 'AI_ASSISTANT'` sẽ render `<AiChatBox onBackToList={...} />` thay vì `ChatContent`.
- Xóa file page độc lập `app/(protected)/ai-assistant/page.tsx` (đã remove vì không còn cần thiết).

## 5. Cách triển khai cụ thể

**Bước 1: Khởi tạo Type và API Service**
- Tạo `mcp.type.ts` với các payload chuẩn.
- Tạo `mcp.service.ts` bao bọc hàm `sendMcpMessage`.

**Bước 2: Giải xuất logic vào hook `useAiChat.ts`**
- Gộp các trạng thái `messages`, `input`, đoạn mã gọi Presigned URL AWS S3 upload và fetch API bot vào một hook thống nhất để giảm tải cho GUI Component độc lập.

**Bước 3: Tích hợp vào hệ thống Chat hiện tại (P2P/Group)**
- Thêm một Sidebar Item tĩnh (Fixed contact) mang tên "Logistics AI Bot" vào component chứa danh sách chat (ví dụ: `ChatSidebar.tsx` hoặc tương đương).
- Khi người dùng click vào "Logistics AI Bot", hệ thống Navigation/State sẽ chuyển `activeChat` sang chế độ AI.
- Khu vực `ChatContainer` sẽ được render bằng Component `AiChatBox` (hoặc tái sử dụng cấu trúc `ChatContent`/`MessageList` hiện tại có bổ sung logic phân nhánh `isAiChat`).

**Bước 4: Tích hợp Upload File (Dành riêng cấu hình AI)**
- Trong giao diện Input của AI, đảm bảo nút đính kèm S3 hoạt động độc lập và gán `publicS3Url` vào payload gửi tới Bot thay vì gửi dạng Message Attachment thông thường.

## 6. Kế Hoạch Tích Hợp Lưu Trữ Lịch Sử Chat AI (AI Chat History)

### 6.1 Mục Tiêu
Hiện tại, khi người dùng chat với AI Assistant qua giao diện `AiChatBox`, tin nhắn chỉ được lưu trong memory ở phía Client. Nếu refresh lại trang, toàn bộ lịch sử hội thoại sẽ bị mất.  
Mục tiêu của kế hoạch này là **áp dụng logic/kiến trúc có sẵn (như đã làm với chat P2P)** để lưu và phục hồi lại lịch sử tin nhắn AI mỗi khi người dùng tải lại trang.

### 6.2 Phân Tích Hiện Trạng
- **Chat P2P hiện tại:** Để lưu trữ một cuộc trò chuyện P2P, server backend tạo ra một **Chat Room** giữa 2 người dùng, sau đó mỗi tin nhắn đều được lưu vào database (thường là qua Socket.io gateway hoặc REST API POST message). Khi tải lại trang, client sẽ gọi API `GET /chat/rooms/:id/messages` (hoặc tương tự) để phục hồi.
- **AiChatBox hiện tại:** Hook `useAiChat` đang dùng `useState` thuần để lưu mảng `messages`. Tin nhắn gửi đi được đẩy thẳng qua endpoint `/mcp/chat` để lấy kết quả mà chưa có định danh Room.

### 6.3 Phương Án Giải Quyết Đề Xuất
Chúng ta sẽ "cải tiến" luồng AI Chat để hoạt động giống như một Room chat P2P đặc biệt:
1. **Phía Backend (`xpress-backend`):**
   - Định nghĩa một loại **Room đặc biệt** dành cho AI Assistant (ví dụ `type: 'AI'`). 
   - Hoặc, lưu thẳng tin nhắn AI thông qua model `Message` có sẵn nhưng với cờ đặc biệt (ví dụ `isAiMessage: true` và liên kết với `userId`).
   - Tạo endpoint API (hoặc sử dụng lại endpoint Get Messages P2P) để truy xuất lịch sử chat với AI của một user cụ thể.
   - Khi có tin nhắn từ user gửi lên `/mcp/chat`, Backend tự động lưu tin nhắn của User, và sau khi AI trả lời, Backend tiếp tục lưu tiếp tin nhắn của AI vào DB trước khi trả về cho Client.
2. **Phía Frontend (`xpress-frontend`):**
   - Khi vào trang (hoặc load mount `AiChatBox`), gọi API để lấy lịch sử chat cũ rồi gán vào state `messages`.
   - Cập nhật lại payload/type model của AI Message (nếu cần) để mapping với type Message trả về từ Backend.

### 6.4 Các Bước Thực Hiện Chi Tiết

**Bước 1: Ổn định cấu trúc Database ở Backend (Tùy chọn nhẹ nhất)**
Thay vì tạo mới bảng, tái sử dụng table `chat_messages`:
- Tạo / Sử dụng API `GET /mcp/chat/history` (hoặc kết hợp vào `chat.controller`) để trả về lịch sử tin nhắn của User với AI.
- Trong endpoint `POST /mcp/chat`, thêm logic Insert DB (tin nhắn user + phản hồi của AI).

**Bước 2: Bổ sung API client ở Frontend**
- Mở file `xpress-frontend/lib/services/mcp.service.ts`:
  - Thêm phương thức `getAiChatHistory(): Promise<McpChatMessage[]>` để gọi GET API lịch sử.

**Bước 3: Cập nhật Hook `useAiChat.ts`**
- Thêm `useEffect` chạy một lần khi component mount:
  - Cài đặt trạng thái loading ban đầu (`isInitialized = false`).
  - Gọi `getAiChatHistory()` từ API Service.
  - Sau khi fetch xong, cập nhật state `setMessages(history)` và set `isInitialized = true`.
- Loại bỏ các dòng tạo dummy system message ban đầu (nếu có), để nhường chỗ cho dữ liệu fetch từ DB.

**Bước 4: Tự động lưu / hiển thị**
- Cấu hình Backend luôn tự lưu vào DB mỗi lần `POST /mcp/chat`. 
- Frontend vẫn tiếp tục đẩy tin nhắn tạm lên UI để có trải nghiệm real-time, nhưng nếu fetch lại sẽ có ID tin nhắn từ server để nhận diện.

### 6.5 Danh Sách Các File Sẽ Bị Tác Động Khi Triển Khai

| Module | File | Hành Động |
| :--- | :--- | :--- |
| **Backend** | `xpress-backend/src/modules/mcp/mcp.controller.ts` | Thêm Endpoint GET `/mcp/chat/history`. Bổ sung AuthGuard, truyền userId vào hàm chat. |
| **Backend** | `xpress-backend/src/modules/mcp/services/mcp.service.ts` | Rút gọn xử lý LLM và tách xuất các trách nhiệm khác (gọi sang `McpClientService` và `McpHistoryService`) |
| **Backend** | `xpress-backend/src/modules/mcp/services/mcp-client.service.ts` | Tách logic khởi tạo, duy trì connection `StdioClientTransport` và chạy tool MCP ra file này (đã di chuyển vào `services/`). |
| **Backend** | `xpress-backend/src/modules/mcp/services/mcp-history.service.ts` | Tách logic Insert tin nhắn và Read lịch sử từ Database (`ChatMessage` entity) ra file này (đã di chuyển vào `services/`). |
| **Backend** | `xpress-backend/src/modules/mcp/mcp.module.ts` | Bổ sung `McpClientService` và `McpHistoryService` vào providers (import từ `services/`). |
| **Backend** | `xpress-backend/src/modules/chat/chat.module.ts` | Export `MessagesRepository` để `McpModule` có thể sử dụng (Import ChatModule vào McpModule). |
| **Frontend** | `xpress-frontend/lib/services/mcp.service.ts` | Thêm hàm request `getAiChatHistory`. |
| **Frontend** | `xpress-frontend/hooks/useAiChat.ts` | Bổ sung `useEffect` lúc init để gọi API get history, lưu vào state `messages`. |
| **Frontend** | `xpress-frontend/types/mcp.type.ts` | Có thể cập nhật lại type `McpChatMessage` để tương đồng với Model Database có `id`, `createdAt`. |
| **Frontend** | `xpress-frontend/components/chat/AiChatBox.tsx` | Xử lý giao diện hiển thị Spinner Loading trong lúc chờ fetch history khi mới mount. |

### 6.6 Khung Thời Gian Dự Kiến & Đánh Giá
- **Backend Task**: Hoàn thành (Cải tiến code, tách service, liên kết DB, tạo API).
- **Frontend Task**: 2 giờ (Tạo Service fetch, cập nhật Hook, UI).
- **Rủi ro**: Việc lưu trữ liên tục câu trả lời AI dài có thể ngốn dung lượng, chú ý không lưu những payload dư thừa.