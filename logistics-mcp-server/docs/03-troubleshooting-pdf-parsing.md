# Khắc phục lỗi Parse PDF không nhận diện được nội dung

## Vấn đề hiện tại
Khi chạy `verify-flow.ts`, hệ thống truy xuất file PDF từ arXiv, upload lên S3 và gọi sang OpenRouter (dùng HTTP Payload chứa base64) để trích xuất văn bản. 
Tuy nhiên, model `google/gemini-2.0-flash-001` qua OpenRouter đang không nhận diện được định dạng payload truyền vào (`"I’m unable to extract text because the document wasn’t attached..."`), dẫn đến text trả về chỉ là lời từ chối của AI.

---

## Các giải pháp đề xuất

### Giải pháp 1: Chuyển sang dùng thư viện trích xuất cục bộ (Khuyên dùng - Best Practice)
Trích xuất text từ file văn bản (PDF, DOCX, TXT) là quá trình deterministic (có tính xác định). Việc sử dụng LLM để đọc text nguyên bản thường tốn kém, chậm, payload cồng kềnh (base64 của một file PDF 30 trang có thể vượt giới hạn token) và dễ sinh lỗi ảo giác (hallucination) hoặc bị từ chối phục vụ như trường hợp trên.

- **Cách làm:** Cài đặt các thư viện open-source đáng tin cậy trên Node.js.
  - PDF: Dùng thư viện `pdf-parse`.
  - TXT: Đọc buffer trực tiếp.
  - Sau khi lấy text thuần thành công, nếu cần phân tích/tóm tắt mới gọi LLM.
- **Những file bị ảnh hưởng:**
  - `package.json`: Thêm bộ cài `npm install pdf-parse`.
  - `src/services/document.service.ts`: Ghi đè phương thức `parseViaOpenRouter` (hoặc đổi tên thành một hàm khác như `extractTextFromFile`) để sử dụng `pdf-parse` cho việc trích xuất văn bản từ Buffer thay vì gọi axios sang OpenRouter. Phương thức này sẽ trực tiếp xử lý `fileBuffer` và trả về `extractedText`.

### Giải pháp 2: Gửi S3 Public URL cho OpenRouter (Nếu S3 là public resouce)
Thay vì nhồi mã Base64 vào payload, ta gửi kèm URL (đã được đẩy lên S3) cho model AI để tự truy cập. 

- **Cách làm:** Đổi payload của OpenRouter, bỏ thuộc tính `file/data` đi và thế bằng đoạn prompt: `"Please read the pdf file at this URL and extract text: {s3_url}"`. (Yêu cầu model đó hỗ trợ duyệt web / auto-download, ví dụ Anthropic Claude 3.5 Sonnet hoặc Gemini có tool browsing).
- **Những file bị ảnh hưởng:**
  - `src/services/document.service.ts`: Thay đổi object truyền vào hàm `axios.post("https://openrouter.ai/api/v1/chat/completions")` ở phần `messages`. 
- **Nhược điểm:** Phụ thuộc cực lớn vào khả năng kết nối URL của model hoặc config của OpenRouter. Hầu hết các model không tự download file từ link nếu tính năng browsing không được bật.

### Giải pháp 3: Fix Payload Base64 đúng chuẩn OpenRouter Multimodal
OpenRouter hỗ trợ multimodal (đọc ảnh/file) bằng cách đóng gói MIME type qua message `image_url` data protocol. Thật ra, Gemini 1.5 và 2.0 có hỗ trợ Base64 PDF, nhưng cấu trúc cần chính xác như sau:

- **Cách làm:** 
```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:application/pdf;base64,{base64Data}"
  }
}
```
*(Thực tế, field gọi là `image_url` ngay cả khi gửi PDF với Gemini/Anthropic đối với OpenRouter API)*.

- **Những file bị ảnh hưởng:**
  - `src/services/document.service.ts`: Update lại payload Base64 theo format kể trên. Xóa khối `plugins: [{ id: "file-parser" }]` nếu nó gây xung đột cho API.
- **Ưu điểm:** Vẫn tận dụng được AI OCR, đọc được cả file scan/ảnh.

---

## Đề xuất triển khai

Tôi mạnh dạn **đề xuất Giải pháp 1 (kết hợp Giải pháp 3 như fallback)**:
1. Dùng `pdf-parse` để đọc PDF text layer (tốc độ dưới 1s, độ tin cậy 100%).
2. Text sau đó đem chunk & embed như bình thường.
3. Việc này sẽ đảm bảo luồng vector DB luôn có dữ liệu thật mà tốn 0$ tiền API cho bước trích xuất này.

Bạn hãy xem xét và cho tôi biết bạn muốn đi theo **Giải pháp 1**, **Giải pháp 3**, hay muốn một cách tiếp cận khác nhé.

---
*🔗 Liên kết (Knowledge Graph Links):*
* Hướng thực thi: [Giải pháp 1 - Local Extraction](./04-solution-local-pdf-extraction.md)
* Tình trạng Flow chung: [Upload Flow Status](./02-upload-flow-status.md)
* Trở về: [README](../README.md)
