import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xpress.app',
  appName: 'Xpress',
  webDir: 'out',
  // LƯU Ý WEB-RTC (CAMERA/MIC): Khi dùng url trỏ tới 1 IP qua HTTP, cơ chế bảo mật của Android/iOS Webview 
  // sẽ chặn hoàn toàn navigator.mediaDevices.getUserMedia
  // => Để test được video call, bạn hãy comment block `server` này lại (để app tự buil local dạng http://localhost) 
  // HOẶC dùng ngrok để cấp proxy HTTPS cho port 3001.
  // server: {
  //   url: 'http://192.168.2.222:3001',
  // url: 'http://192.168.0.124:3001',
  //   cleartext: true
  // },
  // Giữ https://localhost để WebView được coi là "secure context",
  // bắt buộc cho navigator.mediaDevices.getUserMedia (camera / mic / video call).
  // Backend phải truy cập qua HTTPS (dev tunnel Public hoặc ngrok),
  // nếu không sẽ bị Mixed Content chặn.
  server: {
    androidScheme: 'http',
  },
  plugins: {
    Media: {
      androidGalleryMode: true
    },
    // Google Sign-In on native devices is handled by
    // @capacitor-firebase/authentication. The Firebase Android config
    // (google-services.json) already carries the OAuth client metadata,
    // so no runtime plugin options are required here.
    FirebaseAuthentication: {
      providers: ['google.com']
    }
  }
};

export default config;