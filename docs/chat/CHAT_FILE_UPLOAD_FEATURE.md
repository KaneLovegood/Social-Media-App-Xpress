# Triển khai Tính năng Upload Ảnh/File trong Chat

🔗 **Liên kết liên quan (Dependencies):**
- Kiến trúc luồng hệ thống Chat (Core): [[CHAT_FLOW.md]]
- Lộ trình Backend (AWS S3 & API): [[PLAN_STEP1_S3_PRESIGNED_URL.md]]
- Lộ trình Frontend (React/Next.js): [[PLAN_STEP2_FRONTEND_S3_UPLOAD.md]]

Tài liệu này mô tả giải pháp, luồng hoạt động và các bước cụ thể để triển khai tính năng gửi tệp tin (ảnh, tài liệu tĩnh) qua tin nhắn trong module Chat của hệ thống `xpress-backend`.

## 1. Giải pháp đề xuất (Proposed Solution)

Dự án hiện đang sử dụng hệ sinh thái AWS (thể hiện qua `@aws-sdk/client-dynamodb`). Vì vậy, giải pháp tối ưu và chuẩn xác nhất cho file upload là sử dụng **AWS S3** kết hợp với cơ chế **Presigned URL**.

### Tại sao dùng Presigned URL thay vì upload trực tiếp qua NestJS (Multer)?
- **Giảm tải cho Backend**: Tránh việc server Node.js phải xử lý buffering/streaming file, tiết kiệm RAM và CPU.
- **Tốc độ cao hơn**: Client tải trực tiếp file lên máy chủ lưu trữ (S3).
- **Mở rộng dễ dàng**: Không bị phụ thuộc vào giới hạn kích thước body của proxy/load balancer như Nginx/API Gateway đối với app backend.

---

## 2. Luồng hoạt động (Workflow)

Thay vì gửi trực tiếp file qua WebSocket (rất không khuyến khích) hoặc POST file qua Backend, luồng sẽ được thực hiện với 4 bước sau:

1. **Xin quyền Upload (Request Presigned URL)**: 
   - HTTP GET/POST: Client gửi yêu cầu lên Backend (kèm `fileName`, `contentType`) để xin phép tải file.
   - Backend xác thực người dùng, tạo **Presigned URL** thông qua thư viện AWS S3 SDK (có thời hạn VD: 5 phút), và trả về cho Client gồm: `uploadUrl` (gửi file lên) và `publicUrl` (đường dẫn sẽ dùng để xem file).
2. **Client tải file (Upload to S3)**: 
   - Client dùng phương thức HTTP `PUT` gửi trực tiếp ByteArray/File lên cái `uploadUrl` do AWS S3 cấp. Backend hoàn toàn không can thiệp vào tiến trình này.
3. **Gửi tin nhắn WebSocket (Send Message)**: 
   - Khi hàm `PUT` báo thành công (HTTP 200 OK), Client sẽ lấy `publicUrl` để khởi tạo payload tin nhắn.
   - Client phát event socket `chat:send` tới Backend. Lúc này `messageType` là `'IMAGE'` hoặc `'FILE'`, kèm theo metadata (`fileUrl=publicUrl`, `fileName`, `fileSize`, v.v.).
4. **Backend lưu & Broadcast**: 
   - Backend (`ChatGateway` -> `ChatService`) lưu MessageEntity vào DynamoDB như một tin nhắn bình thường và broadcast sự kiện `chat:message` cho Client bên kia.

---

## 3. Các bước thực hiện cụ thể và chi tiết (Frontend & Backend)

Dưới đây là một luồng (flow) cực kỳ chi tiết, chia rõ tầng Backend và Frontend.

### Bước 1 (Backend): Cài đặt và cấu hình thư viện AWS S3
Đầu tiên, bạn cần thư viện của AWS để backend có thể "nói chuyện" với dịch vụ S3 và tạo URL.
Mở terminal ở thư mục `xpress-backend` và chạy:
```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Sau đó thiết lập các biến môi trường trong file `.env` của backend:
```env
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
```

### Bước 2 (Backend): Tạo Service cấp phát `Presigned URL`
Tạo một module (ví dụ `StorageModule` ở `src/modules/storage`) chứa `StorageService`. File này làm 1 nhiệm vụ duy nhất: Khi client hỏi "Tôi muốn gửi file a.png", nó trả về "Đây là link S3 để bạn tải lên".

```typescript
// xpress-backend/src/modules/storage/storage.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  // Khởi tạo S3 Client
  private s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  async generatePresignedUrl(fileName: string, contentType: string) {
    const ext = fileName.split('.').pop();
    // Tạo 1 tên không bao giờ trùng. VD: abc-123.png
    const uniqueFileName = `chat-files/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: uniqueFileName,
      ContentType: contentType,
    });

    // Tạo link bảo mật có hạn trong 5 phút (300 giây)
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    
    // Link để mọi người có thể xem ảnh sau khi upload thành công
    const publicUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;

    return { uploadUrl, publicUrl, fileName, contentType };
  }
}
```

### Bước 3 (Backend): Sửa API Chat và Định nghĩa lưu tin nhắn Ảnh
Bạn cần bổ sung một API để Frontend gọi xin cái `uploadUrl` vừa viết ở `StorageService`:

```typescript
// xpress-backend/src/modules/chat/chat.controller.ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

@Controller('chat')
export class ChatController {
  constructor(private storageService: StorageService) {} // (Hãy nhớ import StorageModule)

  @UseGuards(AuthGuard('jwt'))
  @Post('presigned-url')
  async getPresignedUrl(@Body() body: { fileName: string; contentType: string }) {
    return this.storageService.generatePresignedUrl(body.fileName, body.contentType);
  }
}
```

Sau đó, chỉnh sửa `MessageEntity` và `SendMessageDto` để cơ sở dữ liệu DynamoDB của bạn biết tin nhắn này là tin nhắn dạng ảnh:
```typescript
// xpress-backend/src/modules/chat/dto/send-message.dto.ts
export class SendMessageDto {
  // ..các field cũ
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
  fileUrl?: string; // Sẽ gắn cái publicUrl vào đây
}
```

Khi `ChatService.sendMessage` được gọi, bạn chỉ cần lưu thông tin `fileUrl` và `messageType` đó xuống DB và emit qua Socket.

---

### Bước 4 (Frontend - Next.js): Tích hợp luồng khi người dùng gửi ảnh

Để bạn dễ hình dung, khi người dùng bấm nút duyệt file (ảnh) xong, thao tác gửi tin nhắn lúc này **khác hoàn toàn** với việc gõ chữ bình thường.
Dưới đây là một hàm ví dụ ở Frontend mô tả chính xác những gì xảy ra khi bạn có `file` (từ `<input type="file" />`):

```typescript
// xpress-frontend/component/ChatInput.tsx (Ví dụ)
import axios from 'axios';

const handleSendImage = async (file: File) => {
  try {
    // 1️⃣ XIN QUYỀN TẢI FILE LÊN (Gọi API Backend của bạn)
    const { data } = await axios.post('/api/chat/presigned-url', {
      fileName: file.name,
      contentType: file.type, // vd: image/jpeg
    }, {
      headers: { Authorization: `Bearer ${your_token}` } // Thêm token nếu API cần
    });

    const { uploadUrl, publicUrl } = data;

    // 2️⃣ TẢI ẢNH TRỰC TIẾP LÊN S3
    // Chú ý: Ở đây PUT thẳng lên S3 `uploadUrl`, KHÔNG qua Backend.
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type, // Phải khớp Content-Type đã gửi ở bước 1
      },
    });

    // 3️⃣ GỬI TIN NHẮN (Báo cho socket biết là tôi vừa gửi xong 1 ảnh)
    // Sau khi await xong tức là S3 đã nhận xong ảnh.
    socket.emit('chat:send', {
      receiverId: 'nguoi-nhan-id',
      content: '', // Với ảnh thì content có thể rỗng hoặc lấy làm ghi chú thích
      messageType: file.type.startsWith('image/') ? 'IMAGE' : 'FILE',
      fileUrl: publicUrl, // Link ảnh công khai của S3 để tất cả xem
    });

    // Lúc này socket sẽ emit 'chat:message' tới người nhận, 
    // Người nhận thấy tin nhắn có messageType='IMAGE', fileUrl có link public => Hiện cái <img src={fileUrl} /> lên UI
  } catch (error) {
    console.error("Lỗi khi tải ảnh/tệp lên:", error);
  }
};
```

### Tóm lược vòng đời "Gửi Ảnh":
1. **User gõ chữ bình thường**: Frontend emit `socket.emit('chat:send')` ngay luôn. Không liên quan gì tới S3.
2. **User chọn 1 bức ảnh**: 
   - Frontend không emit socket ngay !!
   - Frontend gửi GET/POST xin Backend "Cho tao 1 giấy phép (URL) S3 để tao upload". -> Backend trả `uploadUrl` (để up) và `publicUrl` (để xem).
   - Frontend tự cặm cụi thực hiện PUT request đưa tấm ảnh bự cộp đó gửi thẳng vào cái `uploadUrl` lên không gian S3 của Amazon. (API quá trình này cực kỳ nhanh vì server S3 rất khỏe, và server Backend của bạn hoàn toàn rảnh rỗi).
   - Khi S3 báo tải lên thành công (100%), Front-end mới mỉm cười và emit báo với WebSocket Backend: "Tao up xong rồi, link của nó là `publicUrl`, báo cho thằng kia biết đi".
   - Backend chỉ việc lưu cái `publicUrl` dán vào chuỗi `Message` như gửi Text bình thường rồi báo qua cho thằng kia.
   - Thằng nhận mở máy lên, nhận được tin nhắn Socket, lấy `publicUrl` nhét vào `<img src={...} />` là hiển thị cái vèo. 

Đấy, mọi thứ hoạt động nhẹ nhàng như vậy đấy! Tránh hoàn toàn việc nhét data ArrayBuffer nặng nề chạy qua WebSocket.

---

## 4. Tóm lược (Summary)
Cách tiếp cận qua Presigned URL là cách tiếp cận Enterprise-standard (tiêu chuẩn chuẩn doanh nghiệp). Việc này đòi hỏi có thêm 1 dịch vụ Cloud Storage như S3 bucket. Nó hoàn toàn tách biệt trách nhiệm giữa Server giữ kết nối Real-time (NestJS WebSocket tải nhẹ) và Server vận chuyển file nặng (S3), giúp hệ thống chat của bạn không bao giờ bị đứng (blocking) khi có nhiều người gửi hình ảnh cùng một lúc.
