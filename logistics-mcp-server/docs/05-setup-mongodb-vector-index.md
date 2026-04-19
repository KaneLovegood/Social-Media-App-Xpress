# Cách thiết lập Vector Search Index trong MongoDB Atlas

Vector Search hiện đang trả về 0 kết quả do trên cơ sở dữ liệu MongoDB `logistics_db`, collection `documents` chưa được tạo chỉ mục tìm kiếm vector (Vector Search Index).

Do bạn dùng Cloud MongoDB Atlas, cấu hình Search Index này phải được thiết lập qua giao diện MongoDB Atlas UI, CLI, hoặc qua Admin API. Bạn không thể tạo nó bằng lệnh `createIndex()` thông thường của MongoDB Driver Node.js.

Embedding model bạn đang sử dụng (`gemini-embedding-001` qua API Gemini) đang sinh ra các vector có **3072 dimensions** (chiều).

Dưới đây là các bước cài đặt:

## 1. Mở giao diện MongoDB Atlas

1. Đăng nhập vào trang quản trị [MongoDB Atlas](https://cloud.mongodb.com/).
2. Chọn **Database** ở thanh menu bên trái.
3. Trong cụm cluster của bạn, click vào nút **Browse Collections**.
4. Mở database `logistics_db`, click vào collection `documents`.

## 2. Tạo Search Index mới

1. Trong giao diện collection `documents`, chọn tab **Atlas Search**.
2. Click nút **Create Search Index**.
3. Khi hệ thống hỏi bạn chọn cấu hình nào, hãy chọn **Atlas Vector Search** (chú ý: phải là Vector Search, không phải text search thông thường), và chọn cấu hình bằng tuỳ chọn **JSON Editor**.
4. Đặt tên Index Name thành chính xác: `vector_index` (Vì trong code `search.service.ts` đang gọi tên là `"index": "vector_index"`).

## 3. Dán đoạn JSON cấu hình sau:

```json
{
  "fields": [
    {
      "numDimensions": 3072,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    }
  ]
}
```

- `"path": "embedding"`: Trỏ vào thuộc tính chứa mảng số vector của chúng ta.
- `"numDimensions": 3072`: Vì Gemini embedding 001/004 tạo mảng độ dài 3072.
- `"similarity": "cosine"`: Thường được thiết kế tối ưu nhất cho text embedding.

## 4. Chờ Index khởi tạo

Sau khi bấm **Create Index**, MongoDB Atlas sẽ bắt đầu lập chỉ mục. Trong quá trình này, trạng thái sẽ là "Initial Sync". 
Tùy vào số lượng file bạn đang có trong DB, thường nó mất 1 - 2 phút.

Khi trạng thái chuyển sang **Active**, bạn chạy lại lệnh `npx tsx test/verify-flow.ts`, nó sẽ bắt đầu hiện ra kết quả cho câu query `"What is the Attention mechanism?"` qua Vector Search!

---
*🔗 Liên kết (Knowledge Graph Links):*
* Luồng tiến độ: [Upload Flow Status](./02-upload-flow-status.md)
* Trở về: [README](../README.md)