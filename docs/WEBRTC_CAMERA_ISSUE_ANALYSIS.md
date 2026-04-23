# Phân tích lỗi không hiển thị Camera WebRTC trên Capacitor

## 1. Phân tích vấn đề hiện tại

Dựa trên hình ảnh bạn cung cấp, thay vì hiển thị luồng Camera (Video stream), thẻ video lại hiển thị **nút Play to đùng ở giữa nền xám**. Điều này chứng tỏ 2 vấn đề:
1. **MediaStream chưa được gán thành công:** Thẻ `<video>` chưa nhận được luồng `srcObject` hợp lệ từ Camera.
2. **Lỗi chính sách AutoPlay của Mobile WebView:** Ngay cả khi có luồng, Android WebView hiển thị nút Play nghĩa là nó đang coi đây là một video thông thường (cần người dùng tương tác để phát) thay vì luồng thời gian thực gán bằng Javascript.
3. **Lỗi môi trường bảo mật (Secure Context):** Thông thường trên Capacitor, để `navigator.mediaDevices.getUserMedia` hoạt động và bật được Camera, WebView yêu cầu ứng dụng phải chạy trong **Secure Context** (tức là HTTPS hoặc URL `http://localhost`, `capacitor://localhost`). Nếu bạn đang cấu hình live-reload qua IP nội bộ (VD: `http://192.168.x.x:3001`), WebView sẽ lập tức chặn quyền truy cập Camera/Mic mà không hề báo lỗi rõ ràng trên UI.

## 2. Giải thích đúng yêu cầu

Hệ thống yêu cầu:
- **Mobile App (Android/iOS):** Thực hiện tính năng Video Call sử dụng công nghệ WebRTC thuần (HTML5 Video, `getUserMedia`, RTCPeerConnection).
- **Trải nghiệm:** Khi vào chế độ gọi, Camera phải tự động bật, luồng video Local hiển thị ở góc nhỏ (hoặc tùy cấu hình), và luồng Remote (của đối tác) hiển thị full màn hình mà không bị block bởi UI video mặc định của hệ điều hành.

## 3. Phương án giải quyết

Để giải quyết triệt để trên nền tảng Capacitor/WebView:
1. **Đảm bảo ứng dụng chạy dưới dạng Secure Context:** Không sử dụng IP trực tiếp `http://192...` qua config `server.url` trong `capacitor.config.ts`. Thay vào đó:
   - Cách 1: Build tĩnh hoàn toàn (`npm run build` -> `cap sync`) để app chạy bằng file local của capacitor ở domain `http://localhost`.
   - Cách 2: Dùng dịch vụ tunnel kết nối thành `https://` (ngrok, devtunnels) để cấu hình vào `server.url` (nếu dùng với mục đích live-reload).
2. **Bổ sung thuộc tính WebKit HTML5:** Trên mobile, để thẻ `<video>` tự động phát MediaStream mà không bị chặn, bắt buộc thẻ này phải có thuộc tính `playsInline` (React: `playsInline`) và đôi khi phải kích hoạt bằng hàm `.play()` trong mã JS sau khi gán luồng.
3. **Bắt và hiển thị lỗi `getUserMedia`:** Cần bao bọc hàm xin quyền WebRTC trong khối `try/catch` để nếu bị từ chối quyền lấy Camera, lập tức hiển thị thông báo lỗi lên cho người dùng biết (do chặn WebView, sai URL HTTP hay user bấm chối quyền).
4. **Cấp quyền WebView (Nếu cần cho phiên bản Native):** Một số Webview đời cũ phải can thiệp vào `WebChromeClient` bằng Java native để đồng ý quyền `onPermissionRequest`. (Với Capacitor từ V4 trở lên thì thường tự xử lý nếu AndroidManifest đủ quyền).

## 4. Đề xuất ưu tiên

- **[Ưu tiên Cực Cao] Tắt Live-reload IP HTTP:** Đảm bảo source web được chạy ở domain bảo mật (`http://localhost` do Capacitor quản lý, hoặc HTTPS). Nếu không, WebRTC chắc chắn "chết từ trứng nước".
- **[Ưu tiên Cao] Gán MediaStream & Cập nhật thẻ Video:** Thêm gọi hàm `.play()` ngay khi stream đã được gán vào `ref.current.srcObject`. Khắc phục triệt để cái nút Play to đùng.
- **[Ưu tiên Vừa] Cập nhật UI thông báo lỗi xin quyền Camera:** Báo lỗi rõ ra màn hình bằng `Toast` thay vì fail ngầm.

## 5. Các file cần thay đổi

1. `capacitor.config.ts`: Xóa bỏ object `server` nếu có chứa `url: 'http://<IP LAN>'` để Capacitor load resource nội bộ.
2. `xpress-frontend/components/video/VideoCallComponent.tsx`: Chỉnh sửa luồng lấy `getUserMedia` và gán Media.
3. `xpress-frontend/components/video/VideoCallOverlay.tsx`: Tinh chỉnh thẻ `<video>` (Thêm class thiết lập css `pointer-events-none` nếu cần để tránh dính điều khiển video cũ).

## 6. Cách triển khai cụ thể

### 6.1. File `capacitor.config.ts`
Chắc chắn rằng bạn đang comment hoặc comment lại cấu hình server như sau khi build lên thiết bị thật:
```typescript
const config: CapacitorConfig = {
  appId: 'com.xpress.app',
  appName: 'Xpress',
  webDir: 'out',
  // TRÁNH SỬ DỤNG HTTP IP LAN nếu muốn WebRTC hoạt động
  // server: {
  //   url: 'http://192.168.0.x:3001',
  //   cleartext: true
  // },
```

### 6.2. Xử lý Play() bắt buộc trên thuộc tính `<video>` trong `VideoCallComponent.tsx`
Khi bạn gán luồng stream, hãy gọi `.play()` để bypass nút Play của Mobile:

```typescript
// Local Stream
useEffect(() => {
  if (localVideoRef.current && localStream) {
    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.play().catch(e => console.error("Lỗi AutoPlay Local: ", e));
  }
}, [localStream]);

// Remote Stream
useEffect(() => {
  if (remoteStream && remoteVideoRef.current) {
    remoteVideoRef.current.srcObject = remoteStream;
    remoteVideoRef.current.play().catch(e => console.error("Lỗi AutoPlay Remote: ", e));
  }
}, [remoteStream]);
```

### 6.3. Xử lý hàm `setupPeer` (Lấy Video Local)
Bắt lỗi và hiển thị cảnh báo thay vì để app sập:
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: withVideo,
    audio: true
  });
  localStreamRef.current = stream;
  setLocalStream(stream);
  startAudioActivityMonitor(stream);
} catch (error: any) {
  console.error("Lỗi getUserMedia: ", error);
  alert("Không thể khởi động Camera/Mic. Lý do: " + error.message + ". Vui lòng cấp quyền hệ thống hoặc chạy trên Context bảo mật.");
  return;
}
```

### 6.4 Tắt Controls Mặc định trên `VideoCallOverlay.tsx`
Nút Play hiện lên do có thể Webview áp dụng điều khiển mặc định, bạn phải thêm thuộc tính disable:
```tsx
<video
  ref={remoteVideoRef}
  autoPlay
  playsInline
  disablePictureInPicture
  controls={false} // Chặn control mặc định (nút Play)
  className="absolute inset-0 z-0 h-full w-full object-cover scale-110 pointer-events-none"
/>
```
*(Thêm `disablePictureInPicture`, `controls={false}` và `pointer-events-none`)*