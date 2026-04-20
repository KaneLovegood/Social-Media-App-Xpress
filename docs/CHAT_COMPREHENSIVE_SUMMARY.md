# Tổng hợp Tài liệu Hệ thống Chat (Comprehensive Chat System Summary)

Tài liệu này tổng hợp toàn bộ các vấn đề, giải pháp và lộ trình triển khai của module Chat trong hệ thống `xpress-backend` và `xpress-frontend`.

---

## 1. Kiến trúc và Luồng hoạt động (Core Architecture & Flows)

### Vấn đề (Issues)
- **Tải trọng Backend**: Trước đây, việc upload file qua server trung gian (Multer/Node.js) gây tốn RAM/CPU và giới hạn băng thông.
- **Tính thời gian thực**: Cần đảm bảo tin nhắn, trạng thái online/offline và cuộc gọi được đồng bộ tức thì.
- **Phức tạp Group Chat**: Việc quản lý thành viên, quyền hạn và tín hiệu (signaling) trong nhóm khó kiểm soát hơn chat 1-1.

### Giải pháp đề xuất (Proposed Solutions)
- **AWS S3 Presigned URL**: Client tải file trực tiếp lên S3. Backend chỉ cấp "giấy phép" (URL).
- **Socket.io Namespaces/Rooms**: Sử dụng `/chat` namespace. Mỗi user có room cá nhân và room cho từng nhóm (`group:<groupId>`).
- **WebRTC Mesh/Signaling**: Sử dụng WebSocket để truyền tải Offer/Answer/ICE giữa các client (P2P Mesh cho Group Call).

---

## 2. Tính năng Upload File & Media (File Upload Feature)

### Phân tích Vấn đề & Giải pháp

| Chủ đề | Vấn đề hiện tại | Giải pháp triển khai |
| :--- | :--- | :--- |
| **Cơ chế Upload** | Upload qua Backend gây nghẽn cổ chai. | **Presigned URL**: Client PUT trực tiếp lên AWS S3. |
| **Dữ liệu tin nhắn** | Dùng Regex parse `content` để tìm link file (không ổn định). | **Structured Data**: Thêm các trường `messageType`, `fileUrl`, `fileName` vào Message Entity. |
| **Loại tệp tin** | Chỉ hỗ trợ IMAGE và FILE tĩnh. | **VIDEO Support**: Bổ sung `messageType='VIDEO'` và renderer `<video>`. |
| **Trải nghiệm (UX)** | ThiếuProgress bar, user tưởng hệ thống lag khi up file lớn. | **XHR onProgress**: Hiển thị thanh % tiến trình và overlay loading. |
| **Xem ảnh/video** | Ảnh hiển thị nhỏ, không phóng to được. | **Media Gallery**: Modal xem ảnh toàn màn hình, hỗ trợ Zoom/Pan. |
| **Bảo mật** | User có thể gởi file vài GB gây tốn phí AWS. | **Multi-layer Validation**: Chặn file >10MB và sai định dạng ở cả Front & Back. |

---

## 3. Lịch sử Media & File (Media/File History)

### Vấn đề
Trước đây, bảng thông tin phòng (`ChatInfoPanel`) cố gắng phân tích chuỗi văn bản (`content`) để hiển thị lại các ảnh/file đã gửi, dẫn đến việc hiển thị sai hoặc thiếu (đặc biệt là Video).

### Giải pháp đã thực hiện
- **Đồng bộ hóa Interface**: Cập nhật `fetchRoomImages` và `fetchRoomFiles` để trả về đúng cấu trúc metadata từ database.
- **UI Logic**: Phân loại rõ ràng:
  - `IMAGE` & `VIDEO`: Hiển thị trong phần "Ảnh & Video" (Video có icon play overlay).
  - `FILE`: Hiển thị kèm icon định dạng, tên file và dung lượng (KB/MB).

---

## 4. Chi tiết các bước triển khai (Implementation Roadmap)

### Bước 1: Backend S3 Integration (Hoàn thành 99%)
- Cài đặt `@aws-sdk/client-s3`.
- Tạo `StorageModule` dùng chung.
- API `POST /chat/presigned-url` được bảo mật bằng `JWT` và `class-validator`.

### Bước 2: Frontend S3 Upload (Hoàn thành 100%)
- Logic Axios/XHR thực hiện `PUT` trực tiếp lên S3.
- Cập nhật Socket Payload để đính kèm metadata sau khi upload thành công.

### Bước 3: UI/UX Polish (Hoàn thành)
- Tích hợp `ImageViewerModal`.
- Progress indicator trên từng attachment đang chờ gửi.

### Bước 4: Security & Cleanup (Hoàn thành)
- Ràng buộc Metadata (Size, Extension) ở mức DTO (Backend).
- Xử lý lỗi mạng (Handling network errors) trong quá trình upload.

---

## 5. Kết luận
Hệ thống chat hiện tại đã đạt tiêu chuẩn Enterprise với kiến trúc **Decoupled Upload** (tách biệt logic chat và lưu trữ file). Hệ thống đảm bảo tính bảo mật (Validation 2 lớp), hiệu suất cao (Direct S3) và trải nghiệm người dùng tốt (Progress UI, Media Gallery).

---
*Tài liệu này được tổng hợp từ 8 file tài liệu chi tiết trong `docs/chat/`.*
