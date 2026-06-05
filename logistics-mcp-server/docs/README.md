# Logistics MCP AI System - Đánh Giá & Hướng Dẫn Kết Nối

Tài liệu này đánh giá hiện trạng của source code `logistics-mcp-server` so với kiến trúc hệ thống hiện tại, mô tả chi tiết danh sách công cụ (Tools), cách cấu hình môi trường, và cung cấp hướng dẫn kết nối MCP Server này với nhiều Client khác nhau (Stdio & SSE).

---

## 🗺️ Bản Đồ Kiến Trúc & Tài Liệu (Knowledge Graph)

Để dễ dàng theo dõi dạng đồ thị (Graph view trong Obsidian/VS Code/GitHub), bạn có thể chuyển hướng giữa các tài liệu bằng các liên kết sau (Wiki Links):

- 🏗️ **Kiến trúc & Luồng dữ liệu:** [Document Flow Core](./01-architecture-document-flow.md) | [Upload Flow Status](./02-upload-flow-status.md)
- 🔌 **Tích hợp WebApp:** [Web App Integration Logic](./06-webapp-integration-architecture.md) ➔ [Web App Implementation Guide](./07-webapp-integration-guide.md)
- 🖥️ **Kết nối Desktop & Agent:** [Desktop & Agent Integration Guide](./08-mcp-desktop-and-agent-integration.md) ➔ [AWS EC2 Deployment Guide](./09-mcp-aws-ec2-deployment-guide.md)
- 🛠️ **Troubleshooting & Setup:** [Sửa lỗi PDF Parsing](./03-troubleshooting-pdf-parsing.md) ➔ [Giải pháp Local Extraction](./04-solution-local-pdf-extraction.md) | [Setup MongoDB Vector Index](./05-setup-mongodb-vector-index.md)

---

## 1. Đánh Giá Hiện Trạng Source Code So Với Thực Tế

Mã nguồn hiện tại đã được cấu trúc lại hoàn toàn theo hướng module hóa (Service-oriented Architecture) và tích hợp thêm nhiều tính năng mới so với thiết kế ban đầu.

### ✅ Những Cải Tiến & Tính Năng Đã Hoàn Thành
1. **Kiến Trúc Đa Giao Thức (Multi-transport MCP Server)**:
   - Hỗ trợ cả **Stdio** (mặc định cho Client chạy local như Cursor, Claude Desktop) và **SSE (Server-Sent Events)** cho Web App và tích hợp Cloud.
   - Có tích hợp sẵn Express Server để xử lý kết nối HTTP/SSE qua các endpoint:
     - `GET /`: Trang chủ hiển thị trạng thái hoạt động.
     - `GET /health`: Endpoint kiểm tra sức khỏe hệ thống.
     - `GET /sse`: Thiết lập kết nối SSE (tự động quản lý các session độc lập thông qua `sessionId`).
     - `POST /messages`: Nhận các gói tin MCP từ client gửi lên.
2. **Cơ Chế Phân Tách Service Rõ Ràng**:
   - `SearchService`: Quản lý kết nối MongoDB, tạo vector embedding qua Gemini, và thực hiện `$vectorSearch` trên MongoDB Atlas.
   - `DocumentService`: Thực hiện đọc/parse tài liệu cục bộ, upload tài liệu thô lên AWS S3 dưới dạng pre-signed URL, chunking văn bản và lập chỉ mục.
   - `IntelligenceService`: Kết nối OpenRouter để xử lý tác vụ thông minh (RAG hỏi đáp, phân tích luồng, gợi ý giải pháp).
   - `ExecutionService`: Tạo kế hoạch và mô phỏng kịch bản logistics.
   - `WebSearchService`: Tìm kiếm Google theo thời gian thực sử dụng Serper API.
   - `CacheService`: Lưu trữ văn bản đã trích xuất vào MongoDB (`document_cache`) dựa trên SHA256 file hash giúp tránh tốn phí parse lại nhiều lần.
   - `S3Service`: Quản lý lưu trữ tài liệu thô trên đám mây AWS S3.
   - `SocialService` (Mới 🆕): Quản lý quan hệ bạn bè, tạo phòng chat, và lấy transcript phục vụ phân tích. Tích hợp trực tiếp với AWS DynamoDB.

3. **Cơ Chế Trích Xuất Tài Liệu Thông Minh**:
   - **Local Extraction**: Sử dụng `pdf-parse` cho PDF, `mammoth` cho DOCX và đọc trực tiếp UTF-8 đối với tệp TXT.
   - **OpenRouter Fallback**: Nếu việc đọc file local trả về rỗng hoặc lỗi, hệ thống tự động chuyển sang mô hình siêu lớn `google/gemini-1.5-pro` thông qua OpenRouter API dưới dạng base64 file data để OCR/trích xuất nâng cao.

---

## 2. Danh Sách Các MCP Tools Đã Đăng Ký

Dưới đây là bảng chi tiết các công cụ (Tools) được khai báo trong `src/index.ts` mà các AI Client có thể gọi:

| Nhóm chức năng | Tên Tool | Các Tham Số Truyền Vào | Mô Tả Chức Năng |
| :--- | :--- | :--- | :--- |
| **Knowledge & RAG** | `logistics_upload_document` | `fileUrl` (string, URL)<br>`type` ("pdf" \| "docx" \| "txt")<br>`metadata` (object, optional) | Tải file từ URL, kiểm tra SHA256 cache, upload S3, trích xuất văn bản (local/fallback Gemini Pro OCR), chia chunk và tạo vector embedding qua Gemini để lưu vào MongoDB Vector Search. |
| | `logistics_search_knowledge` | `queryText` (string)<br>`topK` (number, optional, default: 5) | Thực hiện tìm kiếm ngữ nghĩa (Semantic Vector Search) trên MongoDB Atlas sử dụng index `vector_index`. |
| | `logistics_ask_question` | `question` (string) | Áp dụng quy trình RAG để trả lời câu hỏi chuyên môn dựa trên các tài liệu logistics đã index. |
| **Web Lookup** | `logistics_web_search` | `query` (string) | Tra cứu thông tin logistics thời gian thực trên Internet thông qua Serper API. |
| | `logistics_summarize_topic` | `topic` (string) | Sử dụng tri thức tổng quát của LLM để tóm tắt các chủ đề lý thuyết/xu hướng logistics (không tìm trong file đã upload). |
| **Social (Tương tác nhóm)** | `social_search_user` | `email` (string)<br>`actorUserId` (string) | Tìm kiếm tài khoản người dùng khác bằng email và hiển thị mối quan hệ bạn bè (PENDING, FRIEND, NONE). |
| | `social_send_friend_request` | `actorUserId` (string)<br>`targetUserId` (string) | Gửi yêu cầu kết bạn tới người dùng khác. |
| | `social_create_group` | `title` (string)<br>`actorUserId` (string) | Tạo một phòng chat nhóm mới trong cơ sở dữ liệu DynamoDB. |
| | `social_add_to_group` | `roomId` (string)<br>`targetUserId` (string)<br>`actorUserId` (string) | Thêm thành viên vào phòng chat nhóm (Chỉ ADMIN phòng chat mới có quyền thực hiện). |
| | `social_list_my_groups` | `actorUserId` (string) | Liệt kê danh sách các nhóm chat mà tài khoản hiện tại đang tham gia. |
| | `social_list_friends` | `actorUserId` (string) | Xem danh sách bạn bè và trạng thái các lời mời kết bạn (đang chờ xử lý). |
| | `social_accept_reject_friend`| `actorUserId` (string)<br>`targetUserId` (string)<br>`action` ("ACCEPT" \| "REJECT") | Đồng ý kết bạn hoặc từ chối yêu cầu kết bạn. |
| | `social_get_group_transcript`| `roomId` (string)<br>`actorUserId` (string)<br>`limit` (number, optional, default: 50) | Lấy toàn bộ lịch sử hội thoại dạng văn bản trong phòng chat phục vụ việc tóm tắt, trích xuất thông tin hành động của nhóm bằng AI. |
| **Intelligence** | `logistics_analyze_flow` | `flowDescription` (string) | Phân tích luồng nghiệp vụ logistics và trả về dữ liệu cấu trúc JSON gồm: các điểm nghẽn (bottlenecks), rủi ro (risks), và gợi ý (suggestions). |
| | `logistics_recommend_solution`| `problem` (string) | Cung cấp tối thiểu 3 giải pháp chi tiết xử lý các sự cố logistics. |
| **Execution** | `logistics_create_plan` | `objective` (string)<br>`constraints` (string, optional) | Tạo lập kế hoạch hành động, phân bổ tài nguyên và các cột mốc thực thi logistics. |
| | `logistics_simulate_operation`| `scenario` (string) | Mô phỏng kịch bản để dự báo kết quả vận hành, điểm hiệu quả hiệu suất và các đường găng rủi ro dưới dạng JSON cấu trúc. |

---

## 3. Hướng Dẫn Cấu Hình Biến Môi Trường (`.env`)

Để khởi chạy server đầy đủ chức năng, bạn cần cấu hình tệp `.env` tại thư mục gốc của `logistics-mcp-server` với các khóa sau:

```env
# Kết nối MongoDB (Hỗ trợ Vector Search Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/logistics_db

# LLM Gateway qua OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini # Model chính xử lý các tác vụ phân tích, lập kế hoạch

# Lập Vector Embedding bằng Gemini API
GEMINI_API_KEY=AIzaSy...
OPENROUTER_EMBEDDING_MODEL=gemini-embedding-001

# Tra cứu Web thời gian thực
SERPER_API_KEY=59af9b...

# Lưu trữ tài liệu (AWS S3)
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=xpress-new-technology

# Tính năng Social & Chat Group (AWS DynamoDB)
DDB_TABLE_NAME=Users

# Cấu hình Port phục vụ chế độ SSE (Chạy khi deploy hoặc test SSE)
PORT=3000
MCP_TRANSPORT=sse
```

---

## 4. Hướng Dẫn Cài Đặt Và Khởi Chạy

### 4.1. Cài đặt ban đầu
```bash
# Cài đặt các package dependencies
pnpm install
# hoặc dùng npm
npm install
```

### 4.2. Khởi tạo cơ sở dữ liệu mẫu (Seeding)
Bạn có thể chạy tệp script sau để chèn dữ liệu mẫu, đảm bảo tạo collection và tạo vector index trên MongoDB Atlas:
```bash
node indexDocument.js
```

### 4.3. Build dự án
Biên dịch các tệp TypeScript trong thư mục `src` sang JavaScript trong thư mục `build`:
```bash
pnpm build
# hoặc
npm run build
```

### 4.4. Khởi chạy Server
* **Chế độ phát triển (Hot reload trên local với tsx)**:
  ```bash
  pnpm dev
  ```
* **Chạy Production dưới dạng Stdio Transport (Local CLI/Cursor)**:
  ```bash
  node build/index.js
  ```
* **Chạy dưới dạng SSE Transport (Express Server trên cổng 3000)**:
  ```bash
  node build/index.js --port 3000
  ```

---

## 5. Hướng Dẫn Kết Nối Với Các AI Clients

### 5.1. Kết nối Cursor (Desktop Editor)
Cursor hỗ trợ giao tiếp stdio trực tiếp. Mở **Settings -> Features -> MCP -> + Add New MCP Server**, cấu hình như sau:
* **Name**: `Logistics-MCP-Server`
* **Type**: `command`
* **Command**:
  ```bash
  node <ĐƯỜNG_DẪN_TUYỆT_ĐỐI_ĐẾN_DỰ_ÁN>/logistics-mcp-server/build/index.js
  ```

### 5.2. Kết nối Claude Desktop
Cập nhật tệp cấu hình của Claude Desktop tại địa chỉ `%APPDATA%\Claude\claude_desktop_config.json` (Windows) hoặc `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "logistics-mcp-server": {
      "command": "node",
      "args": [
        "C:/path/to/New-Technology-Xpress/logistics-mcp-server/build/index.js"
      ],
      "env": {
        "MONGODB_URI": "mongodb+srv://hoang2212:...",
        "OPENROUTER_API_KEY": "sk-or-v1-...",
        "GEMINI_API_KEY": "AIzaSy...",
        "SERPER_API_KEY": "59af9b...",
        "AWS_REGION": "ap-southeast-1",
        "AWS_ACCESS_KEY_ID": "AKIA...",
        "AWS_SECRET_ACCESS_KEY": "...",
        "S3_BUCKET_NAME": "xpress-new-technology",
        "DDB_TABLE_NAME": "Users"
      }
    }
  }
}
```

### 5.3. Kết nối mạng trực tiếp qua SSE (Vite / NextJS / Third-party)
Do server đã tích hợp sẵn Express SSE Server, các client có thể kết nối từ xa qua địa chỉ URL. 

Ví dụ kết nối trong ứng dụng JavaScript:
```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(new URL("https://api-domain.com/sse"));
const client = new Client({
  name: "logistics-web-client",
  version: "1.0.0"
});

await client.connect(transport);
const tools = await client.listTools();
console.log("Các tools khả dụng:", tools);
```

---

## 6. Vận Hành AWS EC2 & Ngrok (CI/CD Tự Động)

Hệ thống đã được đóng gói Docker, triển khai lên **AWS EC2** và cấu hình **HTTPS bảo mật miễn phí qua Ngrok** kết hợp với luồng **CI/CD tự động qua GitHub Actions**.

### 6.1. Hướng Dẫn Sử Dụng Địa Chỉ MCP HTTPS

Đường dẫn HTTPS chính thức của bạn để kết nối với các AI Client (Cursor, ChatGPT, Copilot...):
👉 **`https://worsening-ability-smashing.ngrok-free.dev/sse`**

* **Trong Cursor:** Cấu hình ở **Settings -> Features -> MCP -> Add New MCP Server** (chọn Type là `SSE`, dán URL trên vào).
* **Trạng thái kết nối chuẩn:** Khi vào URL trên bằng trình duyệt, màn hình hiển thị:
  ```text
  event: endpoint
  data: /messages?sessionId=...
  ```

---

### 6.2. Cơ Chế CI/CD Tự Động (Không cần vào EC2 cập nhật code)

Mỗi khi bạn thực hiện `git push` code mới lên nhánh **`dev`** có thay đổi thuộc thư mục `logistics-mcp-server/**`:

1. GitHub Actions sẽ tự động kích hoạt SSH kết nối vào EC2 của bạn thông qua các secrets được lưu trên GitHub.
2. Tự động chạy `git pull origin dev` trên máy ảo để cập nhật mã nguồn mới nhất.
3. Tự động build lại Docker image mới và khởi động lại container `mcp-server` trên cổng `3000`.
4. **Không cần bật lại Ngrok**: Vì Ngrok luôn lắng nghe cổng `3000` của máy ảo host, khi container docker được tái khởi động, Ngrok tự động kết nối và tiếp nhận lưu lượng mà **không cần restart Ngrok**, đường dẫn HTTPS của bạn sẽ **giữ nguyên không đổi**!

---

### ⚠️ 6.3. Lưu Ý Quan Trọng Khi Máy Ảo EC2 Bị Khởi Động Lại (Reboot)

Nếu máy ảo EC2 của bạn bị khởi động lại (do AWS bảo trì hoặc bạn chủ động Stop/Start lại máy ảo), tiến trình Ngrok chạy ngầm sẽ bị tắt. Bạn chỉ cần thực hiện 2 bước đơn giản để khôi phục:

1. **SSH truy cập vào EC2**:
   Mở terminal tại máy cá nhân ở thư mục chứa key và gõ:
   ```bash
   ssh -i mcp-server.pem ubuntu@<IP_PUBLIC_CỦA_BẠN>
   ```
2. **Khởi động lại Ngrok chạy ngầm ở cổng 3000**:
   ```bash
   nohup ngrok http 3000 > ngrok.log 2>&1 &
   ```
3. **Kiểm tra nhanh đường dẫn đang chạy**:
   ```bash
   curl http://localhost:4040/api/tunnels | grep -o 'https://[^"]*'
   ```
   *(Đường dẫn HTTPS của bạn sẽ hoạt động bình thường trở lại).*
