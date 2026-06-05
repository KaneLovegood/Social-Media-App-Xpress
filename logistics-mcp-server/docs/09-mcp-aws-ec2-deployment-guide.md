# Hướng Dẫn Triển Khai Logistics MCP Server Lên AWS EC2 & Kết Nối Đa Tác Tử (Cursor, Copilot, ChatGPT)   

Tài liệu này hướng dẫn chi tiết cách nâng cấp cổng kết nối **Logistics MCP Server** từ chế độ chạy cục bộ (`stdio`) sang chế độ dịch vụ mạng trực tuyến (**SSE - Server-Sent Events**), đóng gói bằng **Docker**, triển khai lên máy ảo **AWS EC2**, và cấu hình tên miền bảo mật **HTTPS** qua **Nginx** & **Let's Encrypt** để tích hợp với mọi AI Agent toàn cầu.

---

## 1. Phân Tích Vấn Đề Hiện Tại
* **Giới hạn môi trường chạy:** Máy chủ MCP hiện tại đang sử dụng phương thức truyền tải `stdio` (Standard Input/Output). Đây là phương thức cục bộ tuyệt đối, yêu cầu AI Client (Cursor, VS Code) và MCP Server phải cùng chạy trên một thiết bị vật lý.
* **Không khả thi với Agent đám mây:** Các hệ thống xử lý AI trên đám mây như **GitHub Copilot Chat (đầu xử lý của Microsoft)** hoặc **ChatGPT Custom GPTs (OpenAI)** không chạy trên máy của bạn và không thể SSH/truy cập trực tiếp vào máy tính cá nhân của bạn vì lý do bảo mật.
* **Khó chia sẻ nội bộ:** Đội ngũ phát triển hoặc các ứng dụng khác trong hệ sinh thái New-Technology-Xpress không thể tái sử dụng chung tài nguyên và 16 công cụ logistics của MCP Server.

## 2. Giải Thích Đúng Yêu Cầu
* **Chuyển đổi giao thức mạng:** Cần nâng cấp server để hỗ trợ giao thức mạng **SSE (Server-Sent Events)** song song với `stdio` để mở ra một cổng HTTP trực tuyến cho các Agent từ xa kết nối.
* **Triển khai Cloud ổn định:** Đưa dịch vụ lên máy chủ **AWS EC2** hoạt động liên tục 24/7.
* **Bảo mật kênh truyền:** Cấu hình **HTTPS/SSL** bắt buộc để vượt qua các rào cản bảo mật của OpenAI (ChatGPT) và Microsoft (GitHub Copilot).
* **Đơn giản hóa tích hợp:** Hướng dẫn cách điền địa chỉ để Cursor, VS Code, và ChatGPT có thể gọi công cụ mượt mà.

## 3. Phương Án Giải Quyết
* **Phát triển Hybrid Server:** Thêm thư viện `express` và tích hợp `SSEServerTransport` của Model Context Protocol SDK vào cổng khởi tạo chính của `src/index.ts`.
* **Đóng gói Docker:** Viết `Dockerfile` tối giản để chạy Node.js môi trường production, đảm bảo chạy giống nhau trên cả local và AWS EC2.
* **Cấu hình Reverse Proxy Nginx & Let's Encrypt:** Sử dụng Nginx làm cổng tiếp nhận request HTTPS (cổng 443) từ Internet và chuyển tiếp nội bộ vào Docker (cổng 3000) trên EC2. Cài đặt chứng chỉ SSL miễn phí tự động gia hạn của Let's Encrypt.

## 4. Đề Xuất Ưu Tiên
1. **Ưu tiên 1 (Nền tảng):** Cài đặt Express và cập nhật file `src/index.ts` để hỗ trợ cờ khởi chạy mạng mạng (`--port`).
2. **Ưu tiên 2 (Môi trường):** Viết `Dockerfile` và đẩy toàn bộ mã nguồn lên kho chứa GitHub.
3. **Ưu tiên 3 (Triển khai EC2):** Khởi tạo EC2 (Ubuntu), cài đặt Docker, kéo code về và chạy container.
4. **Ưu tiên 4 (Cấu hình Web):** Trỏ tên miền (Domain) về IP của EC2, cấu hình Nginx và cài SSL Certbot.
5. **Ưu tiên 5 (Bảo mật API Keys):** Đảm bảo thay thế hoàn toàn OpenRouter bằng phương án trực tiếp Google Gemini API miễn phí và bảo mật tuyệt đối các Key trong môi trường EC2.

---

## 5. Các File Cần Thay Đổi & Tạo Mới

### 📁 File 1: `package.json` (Cần bổ sung Express)
Cần cài thêm thư viện Express để phục vụ giao tiếp HTTP/SSE.
```bash
pnpm add express && pnpm add -D @types/express
```

### 📁 File 2: `src/index.ts` (Thay đổi phương thức khởi chạy)
Thay thế hàm `main()` hiện tại bằng đoạn code Hybrid tự động nhận diện chế độ chạy:
```typescript
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

// ... (Giữ nguyên toàn bộ phần cấu hình các Service và Tools ở trên) ...

async function main() {
  try {
    // 1. Kết nối MongoDB
    await searchService.connect();
    console.error("Connected to MongoDB Atlas");

    // 2. Nhận diện PORT từ command line "--port <number>" hoặc từ biến môi trường
    const portIndex = process.argv.indexOf("--port");
    const port = portIndex !== -1 
      ? parseInt(process.argv[portIndex + 1]) 
      : (process.env.PORT ? parseInt(process.env.PORT) : null);

    if (port) {
      // --- CHẾ ĐỘ 1: CHẠY TRÊN CLOUD QUA MẠNG (SSE TRANSPORT) ---
      const app = express();
      app.use(express.json());
      
      let transport: SSEServerTransport | null = null;

      // Endpoint để các AI Agent đăng ký lắng nghe sự kiện từ Server
      app.get("/sse", async (req, res) => {
        console.error("New AI Agent connecting via SSE...");
        transport = new SSEServerTransport("/messages", res);
        await server.connect(transport);
      });

      // Endpoint để các AI Agent gửi yêu cầu gọi Tool
      app.post("/messages", async (req, res) => {
        if (transport) {
          await transport.handlePostMessage(req, res);
        } else {
          res.status(400).send("SSE transport not initialized yet");
        }
      });

      app.listen(port, () => {
        console.error(`🚀 Logistics MCP SSE Server running at http://localhost:${port}/sse`);
      });

    } else {
      // --- CHẾ ĐỘ 2: CHẠY CỤC BỘ DƯỚI LOCAL (STDIO TRANSPORT) ---
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error("🔌 Logistics MCP Server running locally on stdio");
    }

  } catch (error) {
    console.error("Initialization error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
```

### 📁 File 3: `Dockerfile` (Tạo mới ở thư mục gốc của server)
```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base
WORKDIR /app
COPY package*.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/build ./build
EXPOSE 3000
# Chạy với cổng 3000 cho chế độ mạng SSE
CMD ["node", "build/index.js", "--port", "3000"]
```

### 📁 File 4: `.dockerignore` (Tạo mới ở thư mục gốc)
```text
node_modules
build
.git
.env
```

---

## 6. Cách Triển Khai Cụ Thể Trên AWS EC2

### Bước 1: Khởi Tạo Instance AWS EC2 & Mở Cổng Security Group
1. Khởi tạo một máy ảo EC2 mới với cấu hình tối thiểu: **Ubuntu Server 22.04 LTS (t2.micro / t3.small)**.
2. Cấu hình **Security Group** trên AWS Console để mở các cổng mạng sau:
   * **Port 22 (SSH):** Chỉ cho phép IP của bạn truy cập để quản trị.
   * **Port 80 (HTTP):** Cho phép mọi IP (`0.0.0.0/0`) truy cập (dùng để sinh chứng chỉ SSL Let's Encrypt).
   * **Port 443 (HTTPS):** Cho phép mọi IP (`0.0.0.0/0`) truy cập (cổng giao tiếp chính của các AI Agent).

---

### Bước 2: Cài Đặt Docker & Nginx Trên EC2
Sau khi SSH vào máy ảo EC2 (`ssh -i key.pem ubuntu@your-ec2-ip`), chạy các lệnh sau:

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt các công cụ cần thiết
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Cài đặt Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker # Kích hoạt quyền docker không cần sudo
```

---

### Bước 3: Đưa Mã Nguồn Lên EC2 & Khởi Chạy Docker Container
1. Clone dự án Git của bạn về EC2:
   ```bash
   git clone <YOUR_PRIVATE_GITHUB_REPOSITORY_URL> logistics-mcp
   cd logistics-mcp/logistics-mcp-server
   ```
2. Tạo file môi trường `.env` ngay trên EC2 để lưu trữ khóa bí mật:
   ```bash
   nano .env
   ```
   *Dán cấu hình khóa bí mật của bạn vào đây:*
   ```env
   MONGODB_URI=mongodb://...
   GEMINI_API_KEY=AIzaSy...
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   S3_BUCKET_NAME=xpress-new-technology
   DDB_TABLE_NAME=Users
   AWS_REGION=ap-southeast-1
   ```
3. Xây dựng (Build) và chạy Docker container:
   ```bash
   # Build Docker image với nhãn logistics-mcp
   docker build -t logistics-mcp .

   # Chạy container ở chế độ chạy ngầm (detach)
   # Map cổng 3000 của Docker ra cổng 3000 của máy EC2
   docker run -d --name mcp-server --env-file .env -p 3000:3000 --restart always logistics-mcp
   ```
4. Kiểm tra xem container đã chạy chưa:
   ```bash
   docker ps
   # Xem log để chắc chắn server đã kết nối tới MongoDB
   docker logs mcp-server
   ```

---

### Bước 4: Trỏ Tên Miền (Domain) & Cài Đặt SSL HTTPS
Các AI Agent đám mây bắt buộc yêu cầu kết nối bảo mật **HTTPS** (không chấp nhận kết nối HTTP thô hoặc IP số trực tiếp).

1. Truy cập trang quản lý tên miền của bạn (Cloudflare, GoDaddy,...).
2. Tạo một bản ghi **A Record** trỏ tên miền phụ (Subdomain), ví dụ: **`mcp.new-tech-xpress.click`** về **IP công khai của EC2**.
3. Cấu hình **Nginx** làm Reverse Proxy:
   ```bash
   sudo nano /etc/nginx/sites-available/mcp
   ```
   *Dán cấu hình sau vào cấu trúc file:*
   ```nginx
   server {
       listen 80;
       server_name mcp.new-tech-xpress.click; # Thay bằng tên miền của bạn

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # Tối ưu hóa cho truyền tải trực tuyến SSE (Không bị timeout)
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
           chunked_transfer_encoding on;
           proxy_buffering off;
       }
   }
   ```
4. Kích hoạt cấu hình Nginx và khởi động lại:
   ```bash
   sudo ln -s /etc/nginx/sites-available/mcp /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```
5. Sinh chứng chỉ **SSL HTTPS miễn phí** với Let's Encrypt:
   ```bash
   sudo certbot --nginx -d mcp.new-tech-xpress.click
   # Làm theo hướng dẫn trên màn hình (đồng ý điều khoản và chọn tự động Redirect sang HTTPS)
   ```

🎉 **XONG!** Giờ đây máy chủ MCP của bạn đã online trực tuyến an toàn tại địa chỉ:
`https://mcp.new-tech-xpress.click/sse`

---

## 7. Cách Kết Nối Các AI Agent Truy Cập Từ Xa

### 1. Kết nối Cursor IDE (Tất cả máy tính cá nhân)
Mở Cursor -> **Settings** -> **Features** -> **MCP** -> Click **+ Add New MCP Server**:
* **Name:** `logistics-remote`
* **Type:** **`SSE`**
* **URL:** `https://mcp.new-tech-xpress.click/sse`
* Bấm **Save**.

### 2. Kết nối VS Code / GitHub Copilot Chat
Mở file cấu hình MCP của VS Code (nhấn `Ctrl + Shift + P` -> chọn `MCP: Open User Configuration` hoặc dán vào file `.vscode/mcp.json` ở thư mục gốc dự án):
```json
{
  "servers": {
    "logistics-cloud-mcp": {
      "url": "https://mcp.new-tech-xpress.click/sse",
      "type": "http"
    }
  }
}
```

### 3. Kết nối ChatGPT (Custom GPTs / OpenAI Actions)
1. Sử dụng thư viện chuyển đổi tự động **`mcp-to-openapi`** để dịch cổng `https://mcp.new-tech-xpress.click/sse` thành file mô tả OpenAPI `swagger.json`.
2. Tạo một **Custom GPT** mới trên ChatGPT.
3. Kéo xuống mục **Actions** -> Click **Create new Action**.
4. Dán nội dung file `swagger.json` vào mục **Schema**.
5. Nhấn **Save**. ChatGPT giờ đây có thể tự động gọi bất kỳ công cụ nào trong 16 công cụ logistics của bạn để trả lời người dùng toàn cầu!
