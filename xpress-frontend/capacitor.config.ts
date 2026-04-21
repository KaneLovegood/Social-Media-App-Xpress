import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xpress.app',
  appName: 'Xpress',
  webDir: 'out',
  // LƯU Ý WEB-RTC (CAMERA/MIC): Khi dùng url trỏ tới 1 IP qua HTTP, cơ chế bảo mật của Android/iOS Webview 
  // sẽ chặn hoàn toàn navigator.mediaDevices.getUserMedia
  // => Để test được video call, bạn hãy comment block `server` này lại (để app tự buil local dạng http://localhost) 
  // HOẶC dùng ngrok để cấp proxy HTTPS cho port 3001.
  server: {
    url: 'http://192.168.0.124:3001',
    cleartext: true
  },
  plugins: {
    Media: {
      androidGalleryMode: true
    }
  }
};

export default config;