# Phân tích Thiết kế và Tối ưu hóa LLM Tool Calling qua MCP Server

## 1. Phân tích vấn đề hiện tại

Dựa trên log server bạn cung cấp, hệ thống đang gặp 3 vấn đề lớn:

1. **LLM không sử dụng chuẩn Tool Calling (Lộn xộn giữa Text và JSON):** 
   - Log ghi nhận: `Tool calls present: false`. Tuy nhiên trong phần `reply` lại xuất hiện JSON: `{"name": "logistics_analyze_flow", "arguments": ...}`. 
   - **Nguyên nhân:** Model LLM đang cố gắng tự sinh ra cấu trúc file JSON vào trường nội dung văn bản (`content`) thay vì sử dụng mảng `tool_calls` tiêu chuẩn của API. Điều này làm Backend không tự động bắt được trigger gọi hàm.
2. **Sinh ra ký tự lạ / Lỗi Unicode (Hallucination):** 
   - Xuất hiện chuỗi Unicode hiển thị lỗi (`v\u0103n h\u00e0ng \u0111\u1ed3i \u4e3a...`) và dư token hệ thống như `OLCALL>`. 
   - **Nguyên nhân:** Model được chọn trên OpenRouter không mạnh về tiếng Việt hoặc không được fine-tune tốt cho Function Calling. Ngoài ra, chỉ số `temperature` có thể đang thiết lập quá cao.
3. **Bị thắt nút cổ chai về tốc độ (Chậm 14 giây):**
   - Sự chậm trễ diễn ra từ lúc `Calling LLM API` đến khi nhận được response. Việc mở kết nối tới thẳng LLM chỉ để "hỏi xem dùng tool nào" và chờ đợi toàn bộ text tạo ra sự lãng phí rất lớn thời gian chờ cho user. Cùng với việc mỗi lần chat lại đi kết nối lại MCP Server cũng làm tăng độ trễ mạng.

## 2. Giải thích đúng yêu cầu

Hệ thống yêu cầu một quy trình xử lý luồng (Workflow) trơn tru cho LLM:
- Phải tự động nhận diện và kích hoạt đúng tool của `logistics-mcp-server` thông qua chuẩn `tool_calls`.
- Rút ngắn thời gian xử lý chuỗi (Frontend -> Backend -> LLM -> MCP -> LLM -> Frontend).
- Xóa bỏ tình trạng LLM bị hỏng phông chữ, nói ngọng hoặc lặp lại cú pháp lệnh bên trong câu trả lời người dùng.

## 3. Phương án giải quyết

Để giải quyết triệt để, chúng ta cần can thiệp ở cả phía LLM và phía kết nối MCP:

1. **Thay đổi cấu hình Model LLM (Quan trọng nhất):** Phải sử dụng model nổi tiếng và chuyên biệt về Tool Calling (Ví dụ: `gpt-4o-mini`, `claude-3.5-haiku`, hoặc `gemini-1.5-flash`). Các model này có tốc độ tư duy mili-giây và xuất mảng `tool_calls` cực kỳ độ chuẩn xác.
2. **Chuẩn hóa cấu trúc truyền mảng `tools`:** Khi gọi tới OpenRouter/OpenAI API, các tính năng của MCP Server phải được MAP (chuyển đổi) đúng thành định dạng API truyền vào block cấp 1 là `"tools": [...]`. Đảm bảo bật truyền `"tool_choice": "auto"`.
3. **Kiểm soát Temperature:** Giảm thông số độ sáng tạo `temperature` về mốc `0.0` - `0.2` khi LLM phải quyết định gọi tools logic, giúp xóa sạch việc sinh ra các đuôi tag lỗi lạ như `OLCALL>`.
4. **Lưu trú kết nối MCP Server (McpClient Singleton):** Backend NestJS thay vì mỗi request tạo 1 tiến trình stdio mới chạy `logistics-mcp-server`, thì sẽ khởi tạo MCP Server 1 lần duy nhất lúc khởi động Server (trong method `onModuleInit`). Tốc độ gọi lệnh tới MCP Server chỉ còn là tốc độ LAN (<10ms).

## 4. Đề xuất ưu tiên

- **🌟 [Ưu tiên 1 - Tính sống còn] Cập nhật lại logic gọi API OpenRouter:** Sửa đổi model và hạ `temperature` = 0. Đồng thời khai báo rõ định dạng mảng `tools` thay vì prompt text.
- **🌟 [Ưu tiên 2] Thiết lập Singleton cho MCP Client:** Khởi tạo `Client` kết nối tới `logistics-mcp-server` thành dạng dịch vụ sống lâu dài trong NestJS.
- **[Ưu tiên 3] Hỗ trợ luồng Web Stream (Tùy chọn):** Sau khi tối ưu thời gian gọi Tool, chuyển sang dùng Server-Sent Events (SSE) để gửi các câu trả lời đang sinh tới màn hình ngay lập tức (hiệu ứng typing).

## 5. Các file cần thay đổi

- `xpress-backend/src/modules/.../mcp.service.ts`: Phụ trách kết nối OpenRouter, bắt tool gọi mcp client, và xử lý kết nối server singleton bằng StdIO.
- `xpress-backend/src/modules/.../*.controller.ts` (Nếu có hỗ trợ streaming): Trả về JSON logic sửa đổi.

## 6. Cách triển khai cụ thể 

### 6.1. Tối ưu kết nối MCP Server (Singleton Client)
Trong `McpService` (`mcp.service.ts`), đảm bảo bạn dùng thiết kế sau. Điều này khiến Nodejs backend không phải boot script logistics lặp lại nhiều lần.

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private mcpClient: Client;
  private mcpTransport: StdioClientTransport;

  // Khởi chạy MCP Server ngay khi backend start, lưu trong bộ nhớ.
  async onModuleInit() {
    this.mcpTransport = new StdioClientTransport({
      command: "node",
      // Trỏ đúng tới file JS đã build của mcp-server local
      args: ["../logistics-mcp-server/build/index.js"] 
    });

    this.mcpClient = new Client(
      { name: "xpress-nestjs-backend", version: "1.0.0" },
      { capabilities: {} }
    );

    await this.mcpClient.connect(this.mcpTransport);
    console.log("🚀 [McpService] logistics-mcp-server đã khởi chạy & kết nối (Singleton)!");
  }

  async onModuleDestroy() {
    if (this.mcpTransport) await this.mcpTransport.close();
  }
  
  // Dùng client này cho việc query tools nhanh vèo vèo
  async getAvailableTools() {
    const list = await this.mcpClient.listTools();
    return list.tools;
  }
}
```

### 6.2. Cấu hình gọi LLM Tối Ưu (Tránh mã rác & tool ảo)
Khi request OpenRouter, phải chuẩn hóa Object request như sau:

```typescript
// Trong method call LLM của bạn
const systemPrompt = `Bạn là một trợ lý Logistics AI thông minh. Khi người dùng cần tra cứu hoặc thao tác số liệu, bạn BẮT BUỘC KHÔNG trả lời bằng JSON text, mà PHẢI sử dụng công cụ (tool calls). Nếu chưa biết gọi gì thì hỏi lại người dùng.`;

const mcpTools = await this.getAvailableTools();

// Convert cấu trúc tools từ MCP sang format của OpenAPI/OpenRouter
const openAiFormatTools = mcpTools.map(tool => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema // Schema truyền trực tiếp
  }
}));

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini", // HOẶC "google/gemini-1.5-flash" / "anthropic/claude-3.5-haiku" (Nhanh và hỗ trợ Tool chuẩn)
    temperature: 0,              // <= GIẢM XUỐNG 0 để không bị sinh mã rác (OLCALL/JSON leak)
    tool_choice: "auto",         // <= Báo cho LLM biết nếu cân nhắc nên dùng AI tool.
    tools: openAiFormatTools.length > 0 ? openAiFormatTools : undefined,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "quy trình vận hành của logistics" }
    ]
  })
});

const responseJson = await response.json();
const message = responseJson.choices[0].message;

// Đây là nơi bắt đúng mảng tool standard, không phải string parse tay.
if (message.tool_calls && message.tool_calls.length > 0) {
   for (const toolCall of message.tool_calls) {
       const functionName = toolCall.function.name;
       const args = JSON.parse(toolCall.function.arguments);
       
       console.log(`Tiến hành gọi logic MCP qua IPC: ${functionName}`);
       // Thực thi this.mcpClient.callTool({ name: functionName, arguments: args })
   }
} else {
   console.log("LLM trả lời text thông thường: ", message.content);
}
```

Bằng việc cấu hình `model`, `temperature = 0`, và truyền bằng array `tools`, LLM sẽ hoàn toàn không trả JSON lộn xộn trong chuỗi text, tốc độ đánh giá rất nhanh (thường dưới 2s) và giảm tải CPU.
