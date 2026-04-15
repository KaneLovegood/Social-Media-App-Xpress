# Hướng dẫn chạy Backend & Frontend (Dev flow)

Tệp này mô tả các bước rõ ràng để chạy môi trường phát triển cho cả Backend (NestJS) và Frontend (Next.js) trong workspace `New-Technology-Xpress` trên máy Windows (sử dụng bash).

## 1) Yêu cầu tiền đề (Prerequisites)
- Node.js 18+ (hoặc LTS tương thích với `package.json`).
- pnpm (sử dụng pnpm theo repo): cài nếu chưa có

  ```bash
  npm i -g pnpm
  ```

- AWS credentials (nếu bạn muốn test upload lên S3 thực):
  - AWS_REGION
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - S3_BUCKET_NAME

  Lưu ý: nếu không muốn test S3 thật, bạn có thể giả lập hoặc bỏ qua phần upload.

## 2) Cấu trúc thư mục quan trọng
- `xpress-backend/` — NestJS server (API + WebSocket)
- `xpress-frontend/` — Next.js app (UI Chat)
- `docs/` — Tài liệu hướng dẫn

## 3) Thiết lập môi trường

1. Tạo file `.env` cho backend (tại `xpress-backend/.env`) với biến tối thiểu sau:

  ```env
  PORT=3000
  JWT_SECRET=your_jwt_secret_here
  AWS_REGION=ap-southeast-1
  AWS_ACCESS_KEY_ID=AKIA...   # nếu muốn test S3 thật
  AWS_SECRET_ACCESS_KEY=xxx   # nếu muốn test S3 thật
  S3_BUCKET_NAME=your-bucket
  DDB_TABLE_NAME=your-dynamodb-table
  ```

  - Hoặc copy từ `xpress-backend/.env` nếu đã có sẵn. Cẩn thận với khoá bí mật — đừng đẩy lên Git.

2. Thiết lập biến môi trường cho Frontend (tùy chọn) — tạo `xpress-frontend/.env.local`:

  ```env
  NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
  ```

  `NEXT_PUBLIC_API_BASE_URL` được frontend dùng để gọi API backend (ví dụ `getPresignedUrl`).

## 4) Cài đặt dependencies

Mở 2 terminal (hoặc chạy tuần tự) — hướng dẫn dùng bash (Windows WSL / Git Bash):

- Backend

  ```bash
  cd d:/DaiHoc/DuAnNam2_3_4/New-Technology-Xpress/xpress-backend
  pnpm install
  ```

- Frontend

  ```bash
  cd d:/DaiHoc/DuAnNam2_3_4/New-Technology-Xpress/xpress-frontend
  pnpm install
  ```

> Gợi ý: chạy `pnpm install` trong mỗi folder là đủ; repo không dùng workspace root install script.

## 5) Chạy ở chế độ phát triển (Development)

- Start Backend (NestJS, watch mode):

  ```bash
  cd d:/DaiHoc/DuAnNam2_3_4/New-Technology-Xpress/xpress-backend
  pnpm run start:dev
  ```

  - Server mặc định sẽ lắng nghe cổng `3000` (hoặc `process.env.PORT`).
  - WebSocket (Socket.IO) cũng được bật cùng server.

- Start Frontend (Next.js):

  ```bash
  cd d:/DaiHoc/DuAnNam2_3_4/New-Technology-Xpress/xpress-frontend
  pnpm run dev
  ```

  - Mặc định Next.js dev server sẽ chạy ở `http://localhost:3000` — nếu backend đang chiếm port 3000, Next sẽ cố gắng dùng port khác (ví dụ 3001). Để ép Next chạy cổng 3001:

  ```bash
  PORT=3001 pnpm run dev
  ```

  - Nếu bạn dùng `NEXT_PUBLIC_API_BASE_URL` là `http://localhost:3000`, hãy đảm bảo frontend biết cổng backend (đặt `NEXT_PUBLIC_API_BASE_URL` phù hợp trước khi chạy).

## 6) Kiểm tra nhanh (smoke test)

1. Kiểm tra API base:

  ```bash
  curl -i http://localhost:3000/health || curl -i http://localhost:3000/
  ```

  (Nếu repo không có route `/health`, thử mở `http://localhost:3000` trong trình duyệt hoặc kiểm tra logs server.)

2. Kiểm tra route presigned-url (yêu cầu token JWT):

  - Cách 1: Đăng nhập bằng giao diện frontend (nếu đã có user) để nhận token và test tính năng upload trong UI.
  - Cách 2: Gọi API bằng Postman hoặc curl với header Authorization `Bearer <token>`:

  ```bash
  curl -X POST "http://localhost:3000/chat/presigned-url" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <YOUR_JWT>" \
    -d '{"fileName":"test.jpg","contentType":"image/jpeg","fileSize":1024}'
  ```

  - Kết quả hợp lệ: JSON chứa `uploadUrl` và `publicUrl`.

3. Kiểm tra upload từ frontend UI:

  - Mở frontend (Next app) trong trình duyệt.
  - Vào màn chat, chọn file ảnh < 10MB, click gửi. Quan sát thanh tiến trình upload.
  - Khi upload thành công, message với `messageType: "IMAGE"` sẽ được broadcast qua socket và hiển thị ảnh.

## 7) Build & chạy production

- Backend build & start production

  ```bash
  cd xpress-backend
  pnpm run build
  PORT=3000 pnpm run start:prod
  ```

- Frontend build & start

  ```bash
  cd xpress-frontend
  pnpm run build
  NEXT_PUBLIC_API_BASE_URL=http://your-backend-url pnpm run start
  ```

  - Lưu ý: `next start` mặc định chạy server build đã tối ưu, cần đảm bảo `NODE_ENV=production` nếu cần.

## 8) Lint, Test, và Debug

- Backend lint

  ```bash
  cd xpress-backend
  pnpm run lint
  ```

- Backend tests

  ```bash
  pnpm run test
  ```

- Frontend lint

  ```bash
  cd xpress-frontend
  pnpm run lint
  ```

## 9) Troubleshooting nhanh

- Port conflict: nếu cả backend và frontend đều cố gắng dùng `3000`, khởi Next với `PORT=3001 pnpm run dev`.
- Lỗi Presigned URL: kiểm tra `AWS_*` env vars; đảm bảo bucket tồn tại và keys có quyền PutObject.
- Lint/TS errors: đọc logs, sửa theo chỉ dẫn. Dùng `pnpm run build` để thấy lỗi TypeScript rõ ràng.

## 10) Tips & Notes

- Nếu bạn không muốn dùng S3 thật lúc dev, có thể stub `StorageService.generatePresignedUrl` để trả URL giả và bypass upload logic.
- Đừng commit file `.env` chứa khóa AWS/JWT.
- Để test socket realtime thì mở 2 cửa sổ trình duyệt, đăng nhập 2 user khác nhau.

---

Nếu bạn muốn, tôi có thể tiếp tục và:
- Viết script `make dev` để khởi cả hai project cùng lúc (concurrency).
- Tạo file sample `.env.example` cho backend/frontend.
- Tạo hướng dẫn cụ thể để test Presigned upload bằng `curl` + `aws s3api`.

Chọn một trong những thao tác trên nếu bạn muốn tôi thực hiện tiếp.