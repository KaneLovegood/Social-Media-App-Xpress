import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xpress.app',
  appName: 'Xpress',
  webDir: 'out',
  // Giữ https://localhost để WebView được coi là "secure context",
  // bắt buộc cho navigator.mediaDevices.getUserMedia (camera / mic / video call).
  // Backend phải truy cập qua HTTPS (dev tunnel Public hoặc ngrok),
  // nếu không sẽ bị Mixed Content chặn.
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Media: {
      androidGalleryMode: true
    }
  }
};

export default config;