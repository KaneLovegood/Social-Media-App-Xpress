# Hướng dẫn chi tiết: Tích hợp MCP Server vào Web App (Từ Zero)

Để "cắm" MCP Server `logistics-mcp-server` vào một Web App, bạn cần một **Backend (Host App)** đóng vai trò làm trung gian. Frontend (React/Next.js/Vue) sẽ không gọi trực tiếp MCP Server, mà gọi Backend. Backend sẽ kết nối với MCP Server (làm MCP Client) và kết nối với LLM (như OpenAI, Anthropic, Gemini).

Dưới đây là các bước cụ thể để setup Backend (Node.js/Express) kết nối với MCP Server của bạn.

---

## Bước 1: Khởi tạo Backend (Host App)

Quá trình này xây dựng một server Node.js đơn giản làm Host App.

```bash
# Tạo thư mục mới cho Web App Backend
mkdir my-webapp-backend
cd my-webapp-backend

# Khởi tạo project Node.js
npm init -y

# Cài đặt các thư viện cần thiết
npm install express cors dotenv openai
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node @types/express ts-node
```

Tạo file `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true
  },
  "include": ["src/**/*"]
}
```

Tạo file `.env`:
```env
PORT=3001
OPENAI_API_KEY=sk-your-openai-api-key
# Đường dẫn tuyệt đối hoặc tương đối tới file build của MCP Server bạn vừa làm
MCP_SERVER_PATH=D:/mcp-server/logistics-mcp-server/build/index.js
```

---

## Bước 2: Khởi tạo MCP Client trong Backend

Trong Backend, bạn cần viết code khởi tạo **MCP Client**. Client này dùng chuẩn giao tiếp `stdio` để chạy file `index.js` của MCP Server như một tiến trình con (child process).

Tạo file `src/mcp-client.ts`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class McpService {
  private client: Client;

  constructor() {
    this.client = new Client(
      { name: "webapp-mcp-client", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
  }

  async connect(serverPath: string) {
    // Khởi tạo transport chạy file index.js của MCP server
    const transport = new StdioClientTransport({
      command: "node", // Chạy bằng node
      args: [serverPath], // Trỏ tới file build/index.js của logistics-mcp-server
      env: process.env // Truyền biến môi trường xuống cho MCP Server
    });

    await this.client.connect(transport);
    console.log("Đã kết nối thành công tới MCP Server!");
  }

  // Lấy danh sách tools từ MCP Server
  async getTools() {
    const response = await this.client.listTools();
    return response.tools;
  }

  // Yêu cầu MCP Server gọi một tool cụ thể
  async callTool(name: string, args: any) {
    const result = await this.client.callTool({ name, arguments: args });
    return result;
  }
}
```

---

## Bước 3: Tích hợp với LLM và tạo API (Chat Endpoint)

Tạo file `src/server.ts` để dựng API `/api/chat`. Tại đây, Backend sẽ:
1. Gửi tin nhắn của User cho LLM.
2. Lấy danh sách Tools từ MCP Client đưa cho LLM.
3. Nếu LLM muốn gọi Tool, Backend sẽ nhờ MCP Client chạy tool đó trên MCP Server.
4. Trả kết quả text cuối cùng cho Frontend.

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { McpService } from './mcp-client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const mcpService = new McpService();

app.post('/api/chat', async (req, res) => {
  try {
    const { message, fileUrl } = req.body;
    
    // 1. Chuẩn bị message cho LLM
    const messages: any[] = [];
    if (fileUrl) {
      messages.push({ role: 'system', content: `Người dùng vừa upload file tại URL: ${fileUrl}. Hãy lưu và xử lý file này bằng công cụ logistics_upload_document nếu cần.` });
    }
    messages.push({ role: 'user', content: message });

    // 2. Lấy danh sách tools từ MCP Server và convert sang format của OpenAI
    const mcpTools = await mcpService.getTools();
    const openaiTools = mcpTools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema // Input schema từ MCP tự động khớp với JSON Schema của LLM
      }
    }));

    // 3. Gửi cho LLM (Lần 1)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // hoặc tùy bạn chọn
      messages: messages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const responseMessage = completion.choices[0].message;

    // 4. Nếu LLM quyết định gọi Tool (vd: logistics_upload_document hoặc logistics_ask_question)
    if (responseMessage.tool_calls) {
      messages.push(responseMessage); // Thêm phản hồi của LLM vào lịch sử hội thoại

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`Đang thực thi Tool: ${functionName}`, functionArgs);

        // Chuyển lệnh gọi xuống MCP Server
        const mcpResult = await mcpService.callTool(functionName, functionArgs);
        
        // Trích xuất text từ kết quả trả về của MCP
        const mcpTextContext = mcpResult.content.map((c: any) => c.text).join("\n");

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: mcpTextContext,
        });
      }

      // 5. Gửi lại kết quả chạy tool cho LLM để nó tổng hợp câu trả lời cuối (Lần 2)
      const secondResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
      });

      return res.json({ reply: secondResponse.choices[0].message.content });
    }

    // Nếu không gọi tool, trả thẳng kết quả
    res.json({ reply: responseMessage.content });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Khởi động server
const PORT = process.env.PORT || 3001;
mcpService.connect(process.env.MCP_SERVER_PATH || "").then(() => {
  app.listen(PORT, () => {
    console.log(`Backend WebApp (Host) đang chạy tại http://localhost:${PORT}`);
  });
}).catch(console.error);
```

---

## Bước 4: Chạy thử Backend

Bạn khởi động backend lên:
```bash
npx ts-node src/server.ts
```

Lúc này, Backend (Host App) của bạn đã nối với MCP Server `logistics-mcp-server`.

---

## Bước 5: Setup Frontend (Giao diện React/Vue)

Phía Frontend bạn không cần cài thêm thư viện MCP nào cả. Frontend hoàn toàn tách biệt, chỉ cần quan tâm tới làm giao diện Chat và Upload.

Giả sử bạn có thư mục Frontend (React), khi người dùng Upload File hoặc Chat:

```javascript
// Gửi file upload tới S3 hoặc BE của bạn để lấy URL
const uploadFile = async (file) => {
  // Giả lập bạn đã có logic upload và trả về S3 URL
  return "https://s3.amazonaws.com/my-bucket/my-pdf-file.pdf";
};

// Hàm xử lý gửi tin nhắn
const sendMessage = async (userText, file = null) => {
  let fileUrl = null;
  
  if (file) {
    fileUrl = await uploadFile(file); // Frontend upload lấy link
  }

  // Gọi lên Backend (Host App)
  const response = await fetch("http://localhost:3001/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message: userText, 
      fileUrl: fileUrl 
    })
  });

  const data = await response.json();
  console.log("AI Trả lời:", data.reply);
  // Hiển thị data.reply lên khung chat
}
```

### Flow thực tế qua API:
1. **Frontend** POST `{ message: "Đây là file báo cáo Logistics", fileUrl: "https://...pdf" }` gửi lên Backend.
2. **Backend (Host App)** đưa cho OpenAI mổ xẻ nội dung.
3. **OpenAI** thấy có fileUrl, bèn xuất tín hiệu yêu cầu chạy hàm `logistics_upload_document`.
4. **Backend (Host App)** bắt được tín hiệu, dùng `McpService` bắn lệnh qua **MCP Server** qua đường Standard Input/Output (stdio).
5. **MCP Server** tải file, lưu DB, làm Vector, sau đó nhả kết quả `"Xong"` về Backend.
6. **Backend (Host App)** đưa chữ `"Xong"` lại cho OpenAI, OpenAI phán một câu: *"Tôi đã upload và đọc xong tài liệu, bạn cần hỏi gì không?"*
7. **Backend (Host App)** lấy câu đó trả về **Frontend**.

Như vậy, cấu trúc **Frontend -> Backend Host (LLM + MCP Client) -> MCP Server** giúp Web App của bạn cắm được hàng chục MCP Server cùng lúc mà không ảnh hưởng tới code UI.

---
*🔗 Liên kết (Knowledge Graph Links):*
* Thiết kế lý thuyết WebApp: [Web App Integration Flow](./06-webapp-integration-architecture.md)
* Trở về: [README](../README.md)
