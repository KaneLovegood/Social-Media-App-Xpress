# Quy trình tích hợp và cài đặt Capacitor cho Next.js Frontend

Tài liệu này mô tả chi tiết quy trình từng bước để tích hợp **Capacitor** vào dự án Next.js (`xpress-frontend`), giúp chuyển đổi ứng dụng web hiện tại thành ứng dụng di động native (Android & iOS).

---

## 1. Tổng quan cơ chế hoạt động

- **Capacitor** không trực tiếp chạy mã Next.js (Node.js/SSR) trên điện thoại. Thay vào đó, nó đóng gói các tệp tĩnh (HTML, CSS, JS) của ứng dụng web vào một webview native.
- Do đó, chúng ta cần cấu hình Next.js để xuất ra **Static Site Generation (SSG)** bằng tuỳ chọn `output: 'export'`.
- Sau khi Next.js build ra thư mục tĩnh (thường là `out`), Capacitor sẽ copy toàn bộ thư mục này đưa vào thư mục dự án native (`android` / `ios`) để chạy trên thiết bị thực.

---

## 2. Các file đã bị thay đổi và tạo mới

Trong quá trình cài đặt, các file sau đã được chỉnh sửa và khởi tạo:

### Danh sách file cấu hình & thư mục mới Capacitor:
1. `xpress-frontend/package.json`: 
   - Đã cài đặt các dependencies: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`.
   - Đã thêm scripts: `"cap:sync": "cap sync"` và `"build:mobile": "next build && cap sync"` để phục vụ việc tự động compile.
2. `xpress-frontend/next.config.ts`:
   - Đã thêm cấu hình `output: 'export'` và `images: { unoptimized: true }` cho chế độ tĩnh SSG.
3. `xpress-frontend/capacitor.config.ts`: Chứa cấu hình thư mục đầu ra `webDir: 'out'`.
4. `xpress-frontend/android/` & `xpress-frontend/ios/`: Các nền tảng mobile gốc được sinh ra tự động.

### Danh sách file mã nguồn Next.js được điều chỉnh để tương thích ứng dụng tĩnh:
Bởi vì cấu hình `output: 'export'` chuyển app sang dạng SPA (Single Page Application)/SSG, các tính năng liên quan đến Node.js Server Environment như đọc `cookies()` đã được thay thế:
1. `xpress-frontend/app/(protected)/layout.tsx` và `xpress-frontend/app/page.tsx`: Đã đổi từ Server Component sang Client Component (`"use client"`). Sử dụng `getValidAccessToken()` để check token trên Browser thay vì check Cookie từ Server.
2. `xpress-frontend/app/(protected)/chat/[userId]/page.tsx`: Đã chuyển đổi thành client component thực hiện `router.replace` để tránh lỗi Redirect và thiếu hàm `generateStaticParams()` không hỗ trợ khi export tĩnh đoạn URL ID động.
3. `xpress-frontend/components/chat/ChatContainer.tsx`: Fix lỗi logic không tồn tại tham số `token` ở local scope gây crash khi build.

---

## 3. Quy trình thực hiện tải xuống, cấu hình và khởi tạo (Đã hoàn tất)

**Bước 1: Cài đặt thư viện Capacitor**
```bash
cd xpress-frontend
pnpm add @capacitor/core
pnpm add -D @capacitor/cli @capacitor/ios @capacitor/android
```

**Bước 2: Cập nhật Next.js Configuration (`next.config.ts`) và `capacitor.config.ts`**
Chuyển chế độ build sang dạng `export` tĩnh và trỏ root dir về `out`.

**Bước 3: Khắc phục sự cố Build Next.js Export Tĩnh**
Vô hiệu hóa hoặc biến các hàm Server Actions, Server Reading (`cookies()`) thành React Client hook (ví dụ: `useState`, `useEffect`). Build dự án ra thư mục `out`:
```bash
pnpm run build
```

**Bước 4: Thêm nền tảng Native và Build Mobile**
Tạo dự án mobile cho Android và iOS, sau đó đồng bộ thư mục `out` sang source native:
```bash
npx cap add android
npx cap add ios
npx cap sync
```

---

## 4. Các lưu ý & Rủi ro khi chuyển sang Capacitor kết hợp Next.js (SSG)

- **SSR & API Routes:** Bạn không thể dùng API Routes (ví dụ các endpoint trong thư mục `app/api/`) và Server-Side Rendering (SSR) cho Frontend. Mọi request lấy dữ liệu cần phải gọi trực tiếp từ client (như `useEffect` hoặc `SWR/React Query`) lên Backend (NestJS).
- **Domain Server API:** Các API endpoint (đang gọi lên backend) cần được cấu hình dưới dạng domain thực tế (ví dụ: `https://api.yourdomain.com`) thay vì gọi qua `localhost`, vì app sẽ chạy trên điện thoại.

---

## 5. Hướng dẫn chạy thử và sử dụng

Để kiểm tra trên code mobile mới nhất (nếu có chỉnh sửa React code sau này), bạn chỉ cần chạy lệnh mà tôi đã thêm vào `package.json`:

```bash
pnpm run build:mobile
```

*Lệnh này sẽ tự chạy build giao diện web tĩnh, sau đó đồng bộ (sync) chúng vào source native của Android và iOS.*

Để mở project native chạy trên thiết bị giả lập/thật, hãy dùng:

```bash
npx cap open android
# hoặc
npx cap open ios
```

Môi trường tích hợp sẵn (Android Studio / Xcode) sẽ bật lên để bạn tiến hành Build App thật.