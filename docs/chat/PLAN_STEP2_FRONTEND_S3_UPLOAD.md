# Kế hoạch triển khai Bước 2: Tích hợp Upload File lên AWS S3 tại Frontend (Next.js)

🔗 **Liên kết liên quan (Dependencies):**
- Tài liệu kiến trúc tính năng Upload: [[CHAT_FILE_UPLOAD_FEATURE.md]]
- Bước trước đó - Tích hợp API Backend: [[PLAN_STEP1_S3_PRESIGNED_URL.md]]

Tài liệu này mô tả kế hoạch thực hiện **Bước 2** trong tổng thể tiến trình xây dựng tính năng Upload Ảnh/File qua S3 Presigned URL. Ở bước trước (Bước 1), chúng ta đã hoàn tất thiết lập Backend để cấp phát `uploadUrl` và `publicUrl` từ AWS S3. 

Bây giờ là lúc chúng ta ghép nối logic phát hành file thực tế tại Frontend (Next.js).

## 1. Mục tiêu công việc (Goal)
- Khi người dùng đính kèm file/ảnh trong `MessageInput`, NextJS sẽ tự động gửi một API Request xin `Presigned URL` từ Backend.
- Trình duyệt (trực tiếp từ Browser Client) sẽ thực hiện một phương thức `PUT` thẳng phần tử tệp (File/Blob) lên kho lưu trữ AWS S3 của chúng ta mà không thông qua Backend.
- Khi tiến trình `PUT` thành công, Client sẽ gửi emit `chat:send` qua WebSocket đính kèm `publicUrl` cùng với loại tin nhắn (IMAGE, FILE).
- Hiển thị danh sách file đang đính kèm và trạng thái upload (tuỳ chọn UI/UX hiển thị spinner khi gửi xong).

## 2. Luồng thực hiện và giải pháp (Flow & How)

1. **Khởi tạo Interface & API Client mới**: Tạo file hoặc hàm tiện ích ở Next.js dùng cho việc lấy `Presigned URL` (ví dụ `getPresignedUrl(fileName, contentType)`).
2. **Hàm upload trực tiếp lên S3 (axios/fetch)**: Viết hàm `uploadFileToS3(uploadUrl, file, contentType)` sử dụng `axios.put(url, file)` hoặc `fetch` với body là Blob/File. 
3. **Cập nhật Component `MessageInput.tsx`**:
   - Hiện tại `MessageInput` đã quản lý danh sách `attachments: PendingAttachment[]`.
   - Cần thay đổi đoạn xử lý gửi (`onSend`). Thay vì truyền thuần text `content`, nếu có file đính kèm, ta cần loop chạy qua từng file:
     + B1: Gọi API Backend xin URL.
     + B2: Gọi PUT lên `uploadUrl` của S3.
     + B3: Lấy `publicUrl` và trả lại thông tin file (kích cỡ, định dạng, link hiển thị).
4. **Cập nhật Hooks gửi tin nhắn (`useChatRoom` / Socket API)**:
   - Thay vì chỉ truyền `string` nội dung, ta cần cập nhật Socket emit để có thể nhận thêm object chứa `messageType`, `fileUrl`, `fileName`, `fileSize`, `mimeType`.
   - Cập nhật định dạng payload Event `chat:send`.
5. **UI Component (Tuỳ chọn bổ sung)**: 
   - Hiện tuỳ chọn trạng thái `Uploading...` hoặc vô hiệu hoá nút gửi trong lúc tải dữ liệu để tránh user spam multi clicks.
   - Sửa component `MessageItem.tsx` / `MessageBubbleCard.tsx` để render thẻ `<img>` thay vì chỉ `<p>` nếu `messageType === 'IMAGE'` hoặc thẻ `<a>` tải file ngầu `messageType === 'FILE'`.

## 3. Tại sao lại thực hiện theo cách này? (Why)

- **Tối ưu Băng thông Backend**: Như đã đề cập ở tài liệu kiến trúc, Client truyền tải trực tiếp ByteArray khổng lồ bằng HTTP PUT thẳng lên AWS. Gateway hay HTTP Server Backend sẽ không bị quá tải.
- **Trải nghiệm Client tốt**: Gửi nhiều ảnh có thể làm song song bằng `Promise.all` giúp rút gọn thời gian.
- **Tách bạch trạng thái**: UI MessageInput chia ra làm `typing`, `uploading`, và `sent` giúp dễ control UX.

## 4. Danh sách các file đã thay đổi:

✅ **A. Files API & Logic Types (Next.js)**:
- `xpress-frontend/lib/chat-upload.ts` (Đã tạo hàm `getPresignedUrl` lấy URL từ Backend và `uploadFileToS3` đẩy trực tiếp file lên AWS).
- `xpress-frontend/lib/realtime/types.ts` (Đã bổ sung messageType `IMAGE`, `FILE` và các meta data file cho interface).

✅ **B. Files Component UI (Next.js)**:
- `xpress-frontend/components/chat/MessageInput.tsx` (Đã cập nhật onSend để loop qua attachments, upload lần lượt lên S3, và ngăn nhấn gửi liên tục với `isUploading`).
- `xpress-frontend/components/chat/ChatContent.tsx` & `ChatContainer.tsx` (Đã cập nhật interface function `onSend` kèm theo dữ liệu `options` của File đính kèm để emit qua socket).
- `xpress-frontend/components/chat/MessageBubbleCard.tsx` (Bắt các messageType `IMAGE`/`FILE` để render components tương ứng `<img>` hoặc thẻ `<a>` document).

---
👉 **Trạng thái:** **HOÀN THÀNH BƯỚC 2 (100%)**. Hệ thống frontend Next.js đã hoàn tất việc lấy URL, tương tác HTTP upload lên Cloud AWS S3 và phát tín hiệu Realtime qua WebSocket mà không cần gửi buffer ảnh trực tiếp vào Backend.