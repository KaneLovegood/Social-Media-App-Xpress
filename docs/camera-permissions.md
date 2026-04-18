# Cấu Hình Quyền Camera Trong Ứng Dụng Mobile (Capacitor)

## Tổng Quan
Ứng dụng PWA này sử dụng Capacitor để build thành mobile app trên Android và iOS. Để sử dụng camera cho chức năng quét QR và chụp ảnh, cần cấu hình quyền truy cập camera trên cả hai nền tảng.

## Cấu Hình Hiện Tại

### 1. Android (AndroidManifest.xml)
File: `android/app/src/main/AndroidManifest.xml`

Các quyền đã được cấu hình:
```xml
<!-- Quyền truy cập camera -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Camera không bắt buộc (app có thể chạy trên thiết bị không có camera) -->
<uses-feature android:name="android.hardware.camera" android:required="false" />

<!-- Quyền truy cập bộ nhớ (cho lưu ảnh, chọn ảnh từ gallery) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
```

**Giải thích:**
- `CAMERA`: Quyền cơ bản để truy cập camera
- `uses-feature` với `required="false"`: Cho phép app cài đặt trên thiết bị không có camera
- Các quyền storage: Để lưu ảnh chụp hoặc chọn từ gallery

### 2. iOS (Info.plist)
File: `ios/App/App/Info.plist`

Các quyền đã được cấu hình:
```xml
<!-- Quyền truy cập camera -->
<key>NSCameraUsageDescription</key>
<string>ATOMPay cần truy cập camera để quét QR và chụp ảnh.</string>

<!-- Quyền truy cập thư viện ảnh -->
<key>NSPhotoLibraryUsageDescription</key>
<string>ATOMPay cần truy cập thư viện ảnh để tải ảnh lên.</string>

<!-- Quyền lưu ảnh -->
<key>NSPhotoLibraryAddUsageDescription</key>
<string>ATOMPay cần quyền lưu ảnh vào thư viện của bạn.</string>
```

**Giải thích:**
- `NSCameraUsageDescription`: Thông báo hiển thị khi yêu cầu quyền camera (bắt buộc cho iOS)
- `NSPhotoLibraryUsageDescription`: Quyền truy cập photo library
- `NSPhotoLibraryAddUsageDescription`: Quyền lưu ảnh vào library

### 3. Capacitor Config
File: `capacitor.config.ts`

```typescript
plugins: {
  Media: {
    androidGalleryMode: true
  }
}
```

**Giải thích:**
- Plugin Media được cấu hình với `androidGalleryMode: true` để tối ưu hóa việc chọn ảnh từ gallery trên Android

### 4. Code Sử Dụng Camera
File: `src/hooks/use-camera-scan.ts`

Hook `useCameraScan` sử dụng Web API:
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: "environment" },
})
```

**Giải thích:**
- Sử dụng `getUserMedia` với `facingMode: "environment"` để truy cập camera sau (phổ biến cho quét QR)
- Capacitor tự động xử lý việc chuyển đổi Web API này thành native permissions trên mobile

## Quy Trình Yêu Cầu Quyền

1. **Khi app khởi động**: Capacitor kiểm tra và yêu cầu quyền camera nếu cần
2. **Khi sử dụng camera**: Hook `useCameraScan` gọi `getUserMedia`
3. **Trên iOS**: Hiển thị dialog với message từ `NSCameraUsageDescription`
4. **Trên Android**: Tự động cấp quyền dựa trên manifest (có thể hiển thị dialog nếu cần)

## Lưu Ý Quan Trọng

- **iOS**: Phải có `NSCameraUsageDescription` trong Info.plist, nếu không app sẽ crash khi truy cập camera
- **Android**: Quyền camera thường được cấp tự động khi cài đặt, nhưng có thể bị từ chối runtime
- **Testing**: Luôn test trên thiết bị thật vì simulator/emulator có thể không yêu cầu quyền
- **Privacy**: Thông báo quyền nên rõ ràng và chính xác để tránh bị App Store reject

## Troubleshooting

### App bị crash khi mở camera trên iOS
- Kiểm tra có `NSCameraUsageDescription` trong Info.plist không

### Camera không hoạt động trên Android
- Kiểm tra quyền trong Settings > Apps > [App Name] > Permissions
- Đảm bảo `CAMERA` permission có trong AndroidManifest.xml

### Simulator không yêu cầu quyền
- Test trên thiết bị thật để thấy dialog yêu cầu quyền

## Tham Khảo
- [Capacitor Camera Plugin](https://capacitorjs.com/docs/apis/camera)
- [Android Permissions](https://developer.android.com/guide/topics/permissions/overview)
- [iOS Privacy Keys](https://developer.apple.com/documentation/bundleresources/information_property_list/protected_resources)