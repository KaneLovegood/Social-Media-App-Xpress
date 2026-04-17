import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xpress.app',
  appName: 'Xpress',
  webDir: 'out',
  server: {
    // TODO: Thay địa chỉ IPv4 máy tính của bạn vào đây (dùng lệnh ipconfig trên Windows để xem IPv4 Address)
    url: 'http://172.20.10.3:3001',
    cleartext: true // Cho phép Android kết nối HTTP nội bộ thay vì bắt buộc HTTPS
  }
};

export default config;