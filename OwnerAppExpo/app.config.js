module.exports = {
  expo: {
    name: 'Krishna IPTV Owner',
    slug: 'OwnerAppExpo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'ownerappexpo',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.imrankhanchauhan38.OwnerAppExpo',
      // google-services.json is deliberately git-ignored (it's a real
      // Firebase credential) and EAS Build only uploads files tracked by
      // git, so the local path alone isn't reachable from a cloud build.
      // GOOGLE_SERVICES_JSON is a file-type EAS environment variable (see
      // `eas env:list preview`) that resolves to the downloaded file's
      // local path at build time. Falls back to the local file for
      // `expo start`/local builds, where it genuinely exists on disk.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      '@react-native-community/datetimepicker',
      'expo-notifications',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'dd100943-7daa-483c-a371-aa85f00d0756',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/dd100943-7daa-483c-a371-aa85f00d0756',
    },
  },
};
