# Logistics MCP AI System - Đánh Giá & Hướng Dẫn Kết Nối

Tài liệu này đánh giá hiện trạng của source code so với tài liệu `requirements.md` và cung cấp hướng dẫn kết nối MCP Server này với nhiều Client khác nhau.

npm install
npm run build
npx @modelcontextprotocol/inspector node build/index.js

---

## 🗺️ Bản Đồ Kiến Trúc & Tài Liệu (Knowledge Graph)

Để dễ dàng theo dõi dạng đồ thị (Graph view trong Obsidian/VS Code/GitHub), bạn có thể chuyển hướng giữa các tài liệu bằng các liên kết sau (Wiki Links):

- 🏗️ **Kiến trúc & Luồng dữ liệu:** [Document Flow Core](./01-architecture-document-flow.md) | [Upload Flow Status](./02-upload-flow-status.md)
- 🔌 **Tích hợp WebApp:** [Web App Integration Logic](./06-webapp-integration-architecture.md) ➔ [Web App Implementation Guide](./07-webapp-integration-guide.md)
- 🖥️ **Kết nối Desktop & Agent:** [Desktop & Agent Integration Guide](./08-mcp-desktop-and-agent-integration.md) ➔ [AWS EC2 Deployment Guide](./09-mcp-aws-ec2-deployment-guide.md)
- 🛠️ **Troubleshooting & Setup:** [Sửa lỗi PDF Parsing](./03-troubleshooting-pdf-parsing.md) ➔ [Giải pháp Local Extraction](./04-solution-local-pdf-extraction.md) | [Setup MongoDB Vector Index](./05-setup-mongodb-vector-index.md)

---

## 1. Đánh Giá Hiện Trạng Source Code So Với `requirements.md`

Dựa vào việc kiểm tra mã nguồn (đặc biệt là tệp `src/index.ts` và các service đi kèm), dưới đây là đối chiếu những gì hệ thống đã làm được so với yêu cầu ban đầu.

### ✅ Những Yêu Cầu Đã Hoàn Thành (Đúng với Requirement)

1. **Kiến trúc Server MCP**: Source code đã xây dựng thành công Server MCP chạy trên giao thức truyền dẫn chuẩn (stdio) và expose các tool cho AI client sử dụng.
2. **Knowledge Tools (Công Cụ Kiến Thức & RAG)**:
   - `logistics_upload_document`: Đã implement. Hỗ trợ parse tài liệu từ URL (hỗ trợ định dạng pdf, docx, txt) và lập chỉ mục (index) lên MongoDB Vector Search.
   - `logistics_search_knowledge`: Đã implement. Có khả năng search vector thông qua truy vấn tìm kiếm (tìm kiếm ngữ nghĩa).
   - `logistics_ask_question`: Đã implement quy trình RAG (Retrieval-Augmented Generation) để trả lời câu hỏi dựa trên kiến thức logistics.
3. **Web Tools (Công Cụ Tra Cứu Web)**:
   - `logistics_web_search`: Đã kết nối thành công với Serper API để tìm kiếm dữ liệu thời gian thực trên Internet.
   - `logistics_summarize_topic`: Đã khai báo thành một tool độc lập, sử dụng LLM để tóm tắt các chủ đề về logistics.
4. **Logistics Intelligence Tools (Công Cụ Phân Tích Logistics)**:
   - `logistics_analyze_flow`: Đã implement bằng LLM (thông qua OpenRouter) để phân tích luồng công việc.
   - `logistics_recommend_solution`: Đã implement để cung cấp các giải pháp tối ưu.
5. **Execution Tools (Công Cụ Thực Thi/Mô Phỏng)**:
   - `logistics_create_plan` & `logistics_simulate_operation`: Đã được thiết lập thành công cụ gọi đến `ExecutionService` xử lý logic.
6. **Cơ sở dữ liệu (Data Layer)**: Đã tích hợp thành công với tệp MongoDB Vector Search làm kho lưu trữ Vector thay vì Chroma/Pinecone. Đã cấu hình OpenRouter cho LLM/Embeddings.

### ⚠️ Những Yêu Cầu Chưa Hoàn Thiện Hoặc Cần Cải Thiện

1. **MCP Gateway (Architecture)**:
   - Xác thực người dùng (JWT/API Key), Rate Limiting, hay Logging toàn hệ thống dành cho môi trường Multi-client (như Web App, Telegram) cần một tầng Middleware/API Gateway (như Node.js Express hoặc Python FastAPI). System hiện tại chỉ đang là **MCP Server (stdio base)**, rất tốt cho chat client cục bộ (như Cursor/VSCode/Claude Desktop) nhưng chưa expose qua SSE/HTTP để Web hoặc Telegram nối mạng trực tiếp.

---

## 2. Hướng Dẫn Kết Nối Source Này Với Nhiều Khách Hàng (Multiple Clients)

Hệ thống của bạn đang là một **MCP Server** theo chuẩn của Anthropic. Để phục vụ nhiều Client khác nhau như ChatGPT, Telegram Bot, AI Agents (Copilot/Claude), hay Web App, bạn có thể thực hiện theo các mô hình dưới đây.

### 2.1. Kết Nối Với Các Ứng Dụng Desktop Client (Cursor, Claude Desktop, VS Code)

Vì source code hiện đang chạy chuẩn `stdio` transport, bạn chỉ cần sửa file cấu hình của Client.

- **Đối với Claude Desktop**: Sửa file `claude_desktop_config.json`
- **Đối với Cursor**: Gắn lệnh chạy Node trực tiếp.

```json
{
  "mcpServers": {
    "logistics-server": {
      "command": "node",
      "args": [
        "<Đường_dẫn_tuyệt_đối_đến_thu_muc>/logistics-mcp-server/build/index.js"
      ],
      "env": {
        "MONGODB_URI": "mongodb+srv://...",
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

### 2.2. Kết Nối Với Telegram Bot hoặc Web App (Giao Diện UI)

Các nền tảng này không hiểu giao thức MCP trực tiếp (nhất là kênh stdio). Bạn cần thiết lập một **MCP Client Component** hoạc **MCP Gateway** (như đề cập trong requirements).

**Cách thực hiện (Sử dụng Node.js/Express hoặc Python):**

1. **Tạo Backend Server (Express App):** Cài đặt `@modelcontextprotocol/sdk`.
2. **Khởi tạo MCP Client:** Trong backend, khởi tạo một MCP Client và dùng `StdioClientTransport` để kết nối tới `logistics-mcp-server` đang chạy terminal ẩn của bạn.
3. **Mở API cho Web/Telegram:** Thiết lập Rest API / Webhook.
   - Khi Telegram gửi `/ask câu_hỏi` -> API Gateway nhận yêu cầu.
   - API Gateway dùng LLM (ví dụ OpenAI SDK) kết hợp gọi tools từ MCP Client.
   - Hứng kết quả trả về và Reply tin nhắn cho Telegram.

_Mô hình:_
`Telegram App` <--> `Telegram Bot Backend (có chứa MCP Client SDK)` <--(stdio)--> `Logistics MCP Server`.

### 2.3. Kết Nối Với Khung Tác Tử (AI Agents - AutoGPT, LangChain, LlamaIndex)

Với những agent framework, MCP được support rất mạnh mẽ.

- **Nếu dùng LangChain JS/Python:** Cài đặt package `langchain-mcp`. Bạn có thể load tất cả các tools từ Logistics MCP Server thành mảng `tools[]` trong LangChain:

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// 1. Chạy tiến trình logistics server
const transport = new StdioClientTransport({
  command: "node",
  args: ["./build/index.js"]
});

const client = new Client(...);
await client.connect(transport);

// 2. Lấy danh sách tools
const tools = await client.listTools();

// 3. Truyền tool vào Agent của LangChain / OpenAI Function Calling.
```

### 2.4. Kết Nối Mạng Trực Tiếp (Sử dụng SSE Transport)

Thay vì sử dụng `StdioServerTransport` ở file `src/index.ts`, bạn có thể đổi kiến trúc phía Server sang `SSEServerTransport` thông qua Express. Việc này cho phép Server MCP chạy rải rác trên môi trường internet, nhờ đó **ChatGPT (Custom GPT)** hay **Web App** có thể gọi HTTP Webhooks thẳng tới server cổng này để dùng tool.

**Gợi ý cấu hình SSE Transport trong `index.ts`:**

```javascript
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(3000, () => console.log("SSE Logistics Server listening on port 3000"));
```

Với thiết lập này, các hệ thống bên thứ 3 có thể truy cập qua domain `https://api.yourlogistics.com/sse`.

---

## 3. Vận Hành AWS EC2 & Ngrok (CI/CD Tự Động)

Hệ thống đã được đóng gói Docker, triển khai lên **AWS EC2** và cấu hình **HTTPS bảo mật miễn phí qua Ngrok** kết hợp với luồng **CI/CD tự động qua GitHub Actions**.

### 3.1. Hướng Dẫn Sử Dụng Địa Chỉ MCP HTTPS

Đường dẫn HTTPS chính thức của bạn để kết nối với các AI Client (Cursor, ChatGPT, Copilot...):
👉 **`https://worsening-ability-smashing.ngrok-free.dev/sse`**

- **Trong Cursor:** Cấu hình ở **Settings -> Features -> MCP -> Add New MCP Server** (chọn Type là `SSE`, dán URL trên vào).
- **Trạng thái kết nối chuẩn:** Khi vào URL trên bằng trình duyệt, màn hình hiển thị:
  ```text
  event: endpoint
  data: /messages?sessionId=...
  ```

---

### 3.2. Cơ Chế CI/CD Tự Động (Không cần vào EC2 cập nhật code)

Mỗi khi bạn thực hiện `git push` code mới lên nhánh **`dev`** có thay đổi thuộc thư mục `logistics-mcp-server/**`:

1. GitHub Actions sẽ tự động kích hoạt SSH kết nối vào EC2 của bạn thông qua các secrets được lưu trên GitHub.
2. Tự động chạy `git pull origin dev` trên máy ảo để cập nhật mã nguồn mới nhất.
3. Tự động build lại Docker image mới và khởi động lại container `mcp-server` trên cổng `3000`.
4. **Không cần bật lại Ngrok:** Vì Ngrok luôn lắng nghe cổng `3000` của máy ảo host, khi container docker được tái khởi động, Ngrok tự động kết nối và tiếp nhận lưu lượng mà **không cần restart Ngrok**, đường dẫn HTTPS của bạn sẽ **giữ nguyên không đổi**!

---

### ⚠️ 3.3. Lưu Ý Quan Trọng Khi Máy Ảo EC2 Bị Khởi Động Lại (Reboot)

Nếu máy ảo EC2 của bạn bị khởi động lại (do AWS bảo trì hoặc bạn chủ động Stop/Start lại máy ảo), tiến trình Ngrok chạy ngầm sẽ bị tắt. Bạn chỉ cần thực hiện 2 bước đơn giản để khôi phục:

1. **SSH truy cập vào EC2:**
   Mở terminal tại máy cá nhân ở thư mục chứa key và gõ:
   ```bash
   ssh -i mcp-server.pem ubuntu@ <ip public>
   ```
2. **Khởi động lại Ngrok chạy ngầm ở cổng 3000:**
   ```bash
   nohup ngrok http 3000 > ngrok.log 2>&1 &
   ```
3. **Kiểm tra nhanh đường dẫn đang chạy:**
   ```bash
   curl http://localhost:4040/api/tunnels | grep -o 'https://[^"]*'
   ```
   _(Đường dẫn HTTPS của bạn sẽ hoạt động bình thường trở lại)._
