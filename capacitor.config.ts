import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ahmed.triptracker',
  appName: 'Trip Tracker',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true, // Allow cleartext traffic for development
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: undefined,
    },
    // Android specific configuration options
    overrideUserAgent: undefined,
    appendUserAgent: 'Trip Tracker Android App',
    backgroundColor: '#141E30', // Dark blue background color that matches our design
    allowMixedContent: true,    // Important for map services
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#141E30', // Dark blue to match app theme
      androidScaleType: 'CENTER_CROP'
    },
    Geolocation: {
      // Configure Geolocation settings for Android
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION'
      ]
    }
  }
};

export default config;
