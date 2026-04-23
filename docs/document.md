# Luồng xác thực: AuthGuard -> Tax Authority -> Login

Tài liệu này mô tả chi tiết quy trình xác thực và phân quyền liên quan đến `AuthGuard`, `CronAuthController` (trong module Tax Authority) và các luồng đăng nhập, xử lý nghiệp vụ liên quan.

## 1. Tổng quan các thành phần liên quan

- **AuthGuard (`auth.guard.ts`)**: Giải quyết việc xác thực token (JWT) cho toàn bộ ứng dụng, được cấu hình để bảo vệ các endpoints. Nếu token hợp lệ, nó gán thông tin payload vào `request.user`. Trong trường hợp request có gắn decorator `@Public()`, guard này sẽ tự động bỏ qua kiểm tra token.
- **Tax Authority Controller (`tax-authority.controller.ts`)**: Cung cấp các REST API cho phía khách hàng. Bao gồm cả các API dạng công cộng (không yêu cầu token từ người dùng) như đăng nhập (`/login`), đăng ký/cập nhật tài khoản (`/account`) và các API yêu cầu xác thực (`/sync-all`, `/check`).
- **CronAuthService (`tax-authority.service.ts`)**: Dịch vụ chứa toàn bộ logic xử lý: mã hóa/giải mã tài khoản Tổng Cục Thuế (GDT), xử lý đối chiếu thông tin đăng nhập, sinh token, cũng như lấy/refresh token từ API crawler để truy vấn hóa đơn.

## 2. Luồng hoạt động chi tiết

### Bước 1: Khởi tạo/Cập nhật tài khoản Tax Authority (Upsert Account)
- **Endpoint:** `POST /outbound/tax-authority/account`
- **Decorator:** `@Public()` -> Bỏ qua kiểm tra JWT của `AuthGuard`.
- **Cách thức hoạt động:**
  1. Yêu cầu (Request) truyền lên `mst` (Mã số thuế) và `password` (Mật khẩu trên hệ thống hóa đơn điện tử).
  2. `CronAuthService.upsertAccount()` lấy thông tin và băm (hash) `mst` thành `mstHash` (để tìm kiếm nhanh & an toàn trong database).
  3. Mã hóa (encrypt) cả `mst` và `password` bằng thuật toán đối xứng (`encryptSymmetric`) sử dụng `ENCRYPTION_KEY` 64-character (từ file `.env`).
  4. Lưu thông tin đã mã hóa, băm cùng với trạng thái `isActive = true` và reset token cục bộ (`encryptedToken = ''`) vào DB.

### Bước 2: Đăng nhập cấp Token cho Ứng dụng/Khách hàng (Login)
- **Endpoint:** `POST /outbound/tax-authority/login`
- **Decorator:** `@Public()` -> Bỏ qua kiểm tra JWT của `AuthGuard`.
- **Cách thức hoạt động:**
  1. Yêu cầu (Request) từ client gửi `mst` và `password`.
  2. `CronAuthService.login()` băm `mst` thành `mstHash` để đối chiếu trong Database.
  3. Nếu tìm thấy dữ liệu và tài khoản đang hoạt động (`isActive = true`), dịch vụ sẽ thực hiện giải mã (decrypt) `encryptedPassword` bằng `ENCRYPTION_KEY`.
  4. Nếu mật khẩu cung cấp khớp với mật khẩu đã giải mã, `JwtService` sẽ tạo một JWT Token với payload `{ sub: doc._id, mst }`.
  5. Trả JWT Token này (Access Token) về cho client để sử dụng trong những lần gọi sau.

### Bước 3: Bảo vệ các API bằng AuthGuard
- Với các endpoint như `POST .../sync-all` hoặc `GET .../check`, vì không có decorator `@Public()`, luồng gọi bắt buộc phải đi qua `AuthGuard` (`auth.guard.ts`).
- **Cách AuthGuard hoạt động:**
  - `AuthGuard` đọc `IS_PUBLIC_KEY` qua `Reflector`. Không thấy `@Public()`, nó chuyển sang kiểm tra token.
  - Gọi `extractTokenFromHeader` lấy JWT từ header `Authorization: Bearer <token>`. Nếu không có, ném lỗi `UnauthorizedException`.
  - Dùng `this.jwtService.verifyAsync()` để xác thực tính hợp lệ, tính toàn vẹn và hết hạn của token bằng `JWT_SECRET`.
  - Nếu token hợp lệ, gán payload (`mst`, `sub`) vào `request['user']` và cho phép API tiếp tục thi hành. 
  - Nếu thất bại, ném lỗi `UnauthorizedException`.

### Bước 4: Gọi nghiệp vụ và xác thực đến hệ thống bên thứ 3 (Ví dụ GDT Crawler)
- Khi request đã lọt qua `AuthGuard` và vào đến nghiệp vụ bên trong (ví dụ: `fetchAndSyncInvoiceDetail`), `CronAuthService` gọi hàm nội bộ `getValidToken(mst)`.
- **Luồng nội bộ lấy Token từ Crawler System:**
  1. Tìm tài khoản trong DB theo `mstHash`.
  2. Giải mã `encryptedToken` (token làm việc với GDT/Crawler lưu tạm của lần trước).
  3. Kiểm tra tính hợp lệ (`isJwtTokenValid`). Nếu còn hạn thì dùng ngay.
  4. **Nếu đã hết hạn hoặc chưa có:**
     - Giải mã `encryptedMst` và `encryptedPassword`.
     - Gọi POST API `/authenticate` tới một dịch vụ crawler nội bộ/trung gian (Invoice Crawler Auth URL) để thay mặt người dùng đăng nhập hệ thống Tổng Cục Thuế.
     - Dịch vụ crawler trả về một hệ `<token>` GDT hợp lệ.
     - `CronAuthService` nhận token này, mã hóa nó thành `encryptedToken` cất vào DB tái sử dụng cho lượt gọi sau, sau đó dùng token thật gọi tới các nguồn GDT/Hoá đơn điện tử để đối chiếu dữ liệu hóa đơn.

## 3. Tổng kết

Luồng phối hợp chặt chẽ giúp bảo mật thông tin tài khoản của người dùng (MST, Password) bằng các biện pháp băm và mã hóa tại database.
1. **Client -> App:** Client chủ động đăng nhập vào ứng dụng để nhận cấp một JWT (`AuthGuard`).
2. **App -> Guard:** `AuthGuard` làm chốt chặn bảo vệ các API không công khai (không có `@Public`).
3. **App -> Bên thứ 3:** Khi truy xuất dữ liệu từ Tổng Cục Thuế, App tự động sử dụng account đã mã hóa trước đó để "âm thầm" tự động đăng nhập API Crawler, lấy Token và kéo hóa đơn từ cơ quan Thuế về mà client không cần thao tác lại password.
