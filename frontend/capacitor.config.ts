import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.growsphere.bustracker',
  appName: 'BusTracker',
  webDir: 'out',
  android: {
    // Development builds can call a LAN HTTP API. Production must use HTTPS.
    allowMixedContent: true,
    useLegacyBridge: true,
  },
};

export default config;
