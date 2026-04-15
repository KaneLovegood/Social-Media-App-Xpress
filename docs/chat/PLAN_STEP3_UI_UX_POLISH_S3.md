# [ĐÃ HOÀN THÀNH] Bước 3: Hoàn thiện UI/UX và Tối ưu hiển thị tính năng Upload Ảnh/File (Frontend)

🔗 **Liên kết liên quan (Dependencies):**
- Tính năng gốc Chat Upload: [[CHAT_FILE_UPLOAD_FEATURE.md]]
- Lộ trình Frontend (Core): [[PLAN_STEP2_FRONTEND_S3_UPLOAD.md]]

*Lưu ý context:* Toàn bộ Bước 1, 2, 3 và 4 quy định trong `CHAT_FILE_UPLOAD_FEATURE.md` đã được thực thi và gộp chung trong 2 Plan trước đó (Hoàn chỉnh Backend SDK API S3 và Frontend Axios PUT). Kế hoạch "Bước 3" hiện tại tập trung vào việc **nâng cấp trải nghiệm người dùng (UX/UI)** mà một ứng dụng chat tiêu chuẩn cần có.

## 1. Mục tiêu công việc (Goal)
- Khi quá trình upload (đẩy hình ảnh/file lên S3) đang diễn ra qua Axios, Front-end cần phải hiển thị **Thanh tiến trình (Progress Bar) hoặc Loading Spinner** để người dùng biết tin nhắn của họ đang được xử lý, thay vì chỉ khóa nút bấm.
- Xử lý mượt mà tác vụ người dùng bấm vào các hình ảnh trên tin nhắn để **xem phóng to (Gallery/Image Preview Modal)**.
- Triển khai validation kiểm tra kích thước file (tối đa 10MB) và định dạng tập tin hỗ trợ ngay từ lúc chọn ảnh.

## 2. Luồng thực hiện và giải pháp (Flow & How)

1. **Hiển thị Tiến trình Upload (Progress Hook)**:
   - Sửa hàm `uploadFileToS3` sử dụng `xhr` hoặc tuỳ chọn `onUploadProgress` của thư viện HTTP (hiện tại đang dùng fetch cơ bản, sẽ đổi qua Axios hoặc XMLHttpRequest) để lấy `progressEvent.loaded` và tính phần trăm.
   - Thêm một state tính toán % vào UI của `MessageInput` hoặc `AttachmentPreviewTray` để hiển thị overlay loading tương ứng trên tấm ảnh preview.

2. **Chức năng xem phóng to ảnh (Media Gallery)**:
   - Hiện tại ảnh trên `MessageBubbleCard` chỉ được render bằng thẻ `<img>` cố định kích thước (`max-h-75`).
   - Cần bổ sung sự kiện `onClick={() => openGallery(message.fileUrl)}` cho thẻ hiển thị ảnh. Lợi dụng modal `MediaGalleryModal` hoặc viết mới để hiển thị toàn màn hình (Full-screen view) giống Messenger.

3. **Củng cố Validation**:
   - Ở `storage.service.ts` Backend và `MessageInput.tsx` Frontend: Ghi đè bắt lỗi nếu user có ý định upload file khủng (>10, 20MB) vượt mức cấu hình cho phép.

## 3. Tại sao lại thực hiện theo cách này? (Why)

- Việc upload ảnh có thể tốn từ 2 - 10 giây đối với tệp nặng/mạng chậm. Thiếu Progress UI sẽ khiến người nghĩ hệ thống bị đơ (lag), dẫn tới bấm reload hoặc thoát trang.
- Gallery ảnh toàn màn hình là UX cơ bản tối thiểu đối với bất kỳ ứng dụng chat Web nào (Facebook, Zalo) để thuận tiện quan sát chứng từ rõ nét.

## 4. Danh sách các file dự kiến thay đổi:

✅ **Files Component UI (Next.js) đã sửa đổi**:
- `xpress-frontend/lib/chat-upload.ts`: Đổi `fetch` mặc định sang `XMLHttpRequest` kèm theo event `onProgress` trả về số `0-100%`.
- `xpress-frontend/components/chat/MessageInput.tsx` (và `AttachmentPreviewTray.tsx`, `types.ts`): Quản lý object tiến trình `uploadProgress`, hiển thị overlay thanh phần trăm trên các ảnh chờ (Pending attachments) khi đang upload.
- `xpress-frontend/components/chat/MessageBubbleCard.tsx`: Tích hợp trạng thái con trỏ `cursor-pointer` vào thẻ image và truyền callback mở `ImageViewerModal`.
- `xpress-frontend/components/chat/ChatContent.tsx`: Quản lý state đóng/mở Overlay Gallery và truyền `onImageClick` đi xuống Message Bubble.
- `xpress-frontend/components/chat/ImageViewerModal.tsx`: Component mới cho phép xem trước tấm ảnh lớn kèm hỗ trợ Pan, Zoom với cấu trúc chuẩn TailwindCSS v4.

---
🎯 **TRẠNG THÁI: HOÀN THÀNH**
Toàn bộ các yêu cầu của Bước 3 đã được code xong, test linter thành công và sẵn sàng để sử dụng nghiệm thu. Bạn có thể kéo repo về và thử nghiệm upload file có dung lượng lớn để kiểm chứng thanh tiến trình.