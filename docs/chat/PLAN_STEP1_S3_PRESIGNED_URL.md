# Kế hoạch triển khai Bước 1: Tích hợp AWS S3 và Presigned URL (Backend)

🔗 **Liên kết liên quan (Dependencies):**
- Tài liệu kiến trúc - Lý do sử dụng S3: [[CHAT_FILE_UPLOAD_FEATURE.md]]
- Bước tiếp theo - Tích hợp Frontend: [[PLAN_STEP2_FRONTEND_S3_UPLOAD.md]]

Tài liệu này mô tả kế hoạch thực hiện **Bước 1** trong quá trình xây dựng tính năng Upload Ảnh/File (Backend: Cài đặt SDK, chuẩn bị DTO, tạo API cấp quyền Upload).

## 1. Mục tiêu công việc (Goal)
- Giúp Backend (`xpress-backend`) có khả năng cấp phát **Presigned URL** cho Client thông qua thư viện AWS S3.
- Chuẩn bị sẵn lược đồ cơ sở dữ liệu (Database Schema, DTO, Interfaces) để có thể lưu trữ thuộc tính của tin nhắn chứa file (`messageType`, `fileUrl`, `fileName`...).

## 2. Luồng thực hiện (Flow của Bước 1)

1. **Cài đặt thư viện AWS**: Thêm `@aws-sdk/client-s3` và `@aws-sdk/s3-request-presigner` vào `package.json`.
2. **Khai báo biến môi trường**: Bổ sung các biến `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` vào file `.env` (và `.env.example`).
3. **Tạo `StorageModule` & `StorageService`**: Code logic tạo S3 Client và hàm `generatePresignedUrl(fileName, contentType)` để sinh URL có hạn 5 phút.
4. **Cập nhật Chat Interface & DTO**: 
   - Sửa `MessageEntity` (thêm `fileUrl`, `fileName`, `fileSize`, `mimeType`, mở rộng `messageType`).
   - Sửa `SendMessageDto` & `SendGroupMessageDto` tương ứng.
5. **Mở API Endpoint mới**: Thêm API `POST /chat/presigned` vào `ChatController` (gọi đến `StorageService`) để Client xin cấp Webhook/Presigned URL.
6. **Cập nhật Chat Service**: Map dữ liệu file (nếu có) khi hàm `sendMessage` và `sendGroupMessage` khởi tạo `MessageEntity` để lưu xuống DynamoDB.

## 3. Tại sao lại thực hiện theo cách này? (Why)

- **Tách biệt quan tâm (Separation of Concerns)**: Tạo hẳn `StorageModule` thay vì nhét logic S3 vào `ChatModule`. Điều này giúp module `Storage` sau này có thể được dùng lại nếu bạn muốn thêm tính năng Upload Avatar, Upload Document ở các module khác (như User Profile).
- **Chuẩn bị DTO chặt chẽ**: Việc định nghĩa rõ `messageType` là `'TEXT' | 'IMAGE' | 'FILE'` giúp Frontend và Backend đồng bộ chính xác khi hiển thị UI (Tránh nhầm lẫn nội dung văn bản với đường link ảnh).

## 4. Danh sách các file dự kiến thay đổi và tạo mới:

✅ **A. Các file đã tạo mới:**
- `xpress-backend/src/modules/storage/storage.module.ts`
- `xpress-backend/src/modules/storage/storage.service.ts`

✅ **B. Các file đã chỉnh sửa:**
- `xpress-backend/package.json` (Đã bổ sung dependency AWS S3).
- `xpress-backend/src/app.module.ts` (Đã import `StorageModule`).
- `xpress-backend/src/modules/chat/chat.module.ts` (Đã import `StorageModule`).
- `xpress-backend/src/modules/chat/chat.controller.ts` (Đã thêm route API `@Post('presigned-url')`).
- `xpress-backend/src/modules/chat/interfaces/message.interface.ts` (Đã mở rộng thuộc tính file cho Entity).
- `xpress-backend/src/modules/chat/dto/send-message.dto.ts` (Đã bổ sung Validator).
- `xpress-backend/src/modules/chat/dto/send-group-message.dto.ts` (Đã bổ sung Validator).
- `xpress-backend/src/modules/chat/chat.service.ts` (Đã thêm logic nhận dữ liệu URL từ DTO để lưu DB và fix lỗi DTO content).

---

👉 **Trạng thái:** **HOÀN THÀNH BƯỚC 1 (99%)**. Các thư viện cấu hình và Backend API `POST /chat/presigned-url` đã được thiết lập, DTO cũng đã chuẩn bị đầy đủ. Backend nay đã có module Storage chuyên biệt giúp giao tiếp với AWS S3.
