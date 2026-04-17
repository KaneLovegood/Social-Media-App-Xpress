# Kế hoạch triển khai Giải pháp 1: Trích xuất nội dung cục bộ (Local Extraction)

## 1. Mục tiêu
Thay thế việc sử dụng OpenRouter API để trích xuất văn bản từ tài liệu bằng các thư viện cục bộ (local libraries) trực tiếp trên NodeJS. Điều này giúp:
- Xử lý file PDF (và DOCX/TXT) ổn định 100%, không bị lỗi "refuse to read" từ AI.
- Xử lý cực nhanh (thường < 1 giây kể cả file lớn).
- Không tốn chi phí gọi LLM API vô ích cho thao tác đọc chữ.
- Giữ LLM API cho việc cần thiết hơn như tạo Embedding hoặc trả lời câu hỏi (RAG).

## 2. Luồng thực thi chi tiết (Flow)
1. **Tải file:** Nhận `fileUrl` và dùng axios tải file về dưới dạng `Buffer` (Giữ nguyên).
2. **Cache:** Tính toán mã băm (hash) và kiểm tra dữ liệu đã lưu trong cache chưa (Giữ nguyên).
3. **Lưu trữ:** Upload `Buffer` lên S3 để làm file gốc lưu trữ (Giữ nguyên).
4. **Trích xuất cục bộ (Bước thay đổi cốt lõi):** 
   - Kiểm tra định dạng (`type`):
     - Nếu là `pdf`: Dùng thư viện `pdf-parse` để đọc text trực tiếp từ Buffer.
     - Nếu là `docx`: Dùng thư viện `mammoth` để lấy chuỗi văn bản.
     - Nếu là `txt`: Dùng hàm chuẩn `fileBuffer.toString('utf-8')`.
5. **Fallback (Dự phòng ngập ngừng):** Trong trường hợp thư viện cục bộ đọc file thất bại (do file scan, file ảnh), có thể tùy chọn gọi xuống OpenRouter (Vision) như một bước dự phòng (fallback). *Khuyến nghị tạm thời bỏ qua fallback phức tạp nếu hệ thống chủ yếu làm việc với PDF text.*
6. **Lưu Cache & Trả kết quả:** Lưu nguyên văn đoạn text lấy được vào Cache và trả về module index.

## 3. Các file bị ảnh hưởng

### 1. `package.json`
- **Thay đổi:** Thêm các module mới vào `dependencies`.
- **Cần chạy lệnh:**
  ```bash
  npm install pdf-parse mammoth
  npm install --save-dev @types/pdf-parse
  ```

### 2. `src/services/document.service.ts`
- **Thay đổi 1 (Imports):** Import thư viện `pdf-parse` và `mammoth`.
- **Thay đổi 2 (Thêm method mới):** Tạo hàm `extractTextLocally(fileBuffer: Buffer, type: string): Promise<string>`.
  - Logic bên trong dùng switch-case dựa vào tham số `type`.
- **Thay đổi 3 (Cập nhật logic `parseDocument`):**
  - Đổi block mã gọi `generateFileHash` và thay việc gọi hàm `this.parseViaOpenRouter(...)` thành `this.extractTextLocally(fileBuffer, type)`.
  - Hàm `parseViaOpenRouter` cũ có thể giữ làm hàm dự phòng (fallback) hoặc xóa đi tùy ý muốn để dọn dẹp code.

## Phê duyệt nội dung
Tiến trình trên đảm bảo sẽ không chặn (block) các mã nghiệp vụ đang tốt như Vector Embedding hay Vector Search. Nếu bạn đồng ý với kế hoạch này, tôi sẽ tiến hành cài đặt thư viện và sửa mã nguồn trong `document.service.ts`. Cứ ra lệnh cho tôi "Tiến hành giải pháp 1"!

---
*🔗 Liên kết (Knowledge Graph Links):* 
* [Vấn Đề Gốc: Parse PDF](./03-troubleshooting-pdf-parsing.md)
* [Tiến độ: Upload Flow Status](./02-upload-flow-status.md)
* Trở về: [README](../README.md)