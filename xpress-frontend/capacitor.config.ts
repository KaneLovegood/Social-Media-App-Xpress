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
    },
    // Google Sign-In (native) via @capgo/capacitor-social-login.
    // Only the `google` provider is bundled to keep the APK size small.
    // The actual Web Client ID is passed at runtime via SocialLogin.initialize()
    // so it can come from NEXT_PUBLIC_GOOGLE_CLIENT_ID without being hard-coded here.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false
      }
    }
  }
};

export default config;