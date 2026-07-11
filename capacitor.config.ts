import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.roadfighter.app',
  appName: 'Road Fighter',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
