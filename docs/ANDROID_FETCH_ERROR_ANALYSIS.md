# Phân tích nguyên nhân và cách khắc phục lỗi "Failed to fetch" khi đăng nhập trên thiết bị Android (Capacitor)

## 1. Hiện tượng (Symptom)
Khi bạn chạy ứng dụng trên trình duyệt web ở máy tính, chức năng Đăng nhập hoạt động bình thường. Tuy nhiên, sau khi build sang Android qua Capacitor và mở trên máy ảo (Emulator) hoặc điện thoại thật, khi bấm đăng nhập hệ thống báo lỗi **"Failed to fetch"** (hoặc `Network Error`).

## 2. Nguyên nhân gốc rễ (Root Causes)

Lỗi "Failed to fetch" trên môi trường mobile thường xuất phát từ 3 nguyên nhân chính sau:

### 2.1. Vấn đề về địa chỉ `localhost` (Phổ biến nhất)
- Trong file `.env` hoặc `.env.local` ở frontend, biến môi trường (ví dụ: `NEXT_PUBLIC_API_BASE_URL`) của bạn đang được set là `http://localhost:3000`.
- **Trên máy tính:** `localhost` trỏ về chính máy tính đang chạy backend.
- **Trên Android (Emulator/Máy thật):** `localhost` (hoặc `127.0.0.1`) sẽ trỏ về **chính cái điện thoại/máy ảo đó**, chứ KHÔNG trỏ về máy tính của bạn. Do đó, app Android không tìm thấy backend nào đang chạy ở port 3000 trên điện thoại, dẫn đến lỗi từ chối kết nối (Connection Refused -> Failed to fetch).

### 2.2. Chính sách bảo mật HTTP (Cleartext Traffic) của Android
Từ Android 9 (API level 28) trở lên, Google mặc định **chặn tất cả các kết nối mạng không được mã hóa (HTTP)**. 
- Nếu backend của bạn đang chạy ở `http://...` (không có `https`), hệ điều hành Android sẽ tự động block request này ở tầng network trước khi nó kịp đi ra ngoài.

### 2.3. Vấn đề về mạng hoặc tường lửa (Firewall)
- Thiết bị di động và máy tính không cùng nằm trên một mạng WiFi.
- Tường lửa trên Windows (Windows Defender) đang chặn kết nối đến port 3000 từ các thiết bị khác trong mạng LAN.

---

## 3. Hướng khắc phục chi tiết (Solutions)

Để giải quyết vấn đề này, bạn cần thực hiện tuần tự các bước sau:

### Bước 1: Thay đổi địa chỉ API từ `localhost` sang IP của máy tính
Bạn cần tìm địa chỉ IP IPv4 của mạng LAN hiện tại trên máy tính (ví dụ: `192.168.1.15`).

**Nếu bạn dùng máy ảo Android Studio (Android Emulator):**
- Theo mặc định của Android Emulator, địa chỉ IP trỏ về máy ảo host (máy tính của bạn) là `10.0.2.2`.
- Đổi `.env.local` ở frontend: `NEXT_PUBLIC_API_BASE_URL=http://10.0.2.2:3000`

**Nếu bạn dùng điện thoại Android thật (cắm cáp USB hoặc chung WiFi):**
- Đổi `.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://<ĐỊA_CHỈ_IP_WIFI_CỦA_MÁY_TÍNH>:3000` (VD: `http://192.168.1.45:3000`).

*(Sau khi đổi file `.env`, bạn cần phải build lại frontend: `npm run build` hoặc `pnpm build`)*.

### Bước 2: Cho phép HTTP (Cleartext Traffic) trong Android
Mở file `android/app/src/main/AndroidManifest.xml` trong thư mục `xpress-frontend`, tìm thẻ `<application...>` và thêm thuộc tính `android:usesCleartextTraffic="true"`:

```xml
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/AppTheme"
    android:usesCleartextTraffic="true" <!-- BỔ SUNG DÒNG NÀY -->
>
```

### Bước 3: Mở tường lửa (Firewall) cho máy tính (Chỉ cần nếu dùng IP LAN máy thật)
Nếu máy bạn là Windows, bạn phải đảm bảo port 3000 (Backend) không bị chặn:
1. Mở "Windows Defender Firewall with Advanced Security".
2. Tạo Inbound Rule mới -> Chọn "Port" -> TCP -> Nhập: `3000`.
3. Cho phép "Allow the connection".

### Bước 4: Đồng bộ lại code vào hệ điều hành Android
Mỗi khi bạn sửa code Next.js hoặc đổi file `.env`, code HTML/CSS/JS phải được build lại và copy vào app Android bằng các lệnh sau:

```bash
# 1. Tại thư mục xpress-frontend
pnpm build

# 2. Trỏ code mới build vào nền tảng android
npx cap copy android

# 3. (Tùy chọn) Mở lại Android Studio để chạy thử
npx cap open android
```

### Bước 5: Cấu hình Backend Binding (Quan trọng)
Backend NestJS của bạn phải được cấu hình để lắng nghe mọi kết nối, không chỉ giới hạn ở localhost.
Trong file `main.ts` của backend, hãy sửa dòng `app.listen(3000)` thành:
```typescript
await app.listen(3000, '0.0.0.0'); // Lắng nghe trên mọi IPv4
```

Sau khi làm đủ 5 bước trên, app Android trên điện thoại của bạn sẽ call và đăng nhập thành công vào Backend!