import type { ConfigContext, ExpoConfig } from "expo/config";

import appConfigJson from "./src/app/config/appConfig.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appConfigJson.APP_NAME,
  slug: "tms",
  scheme: "tms",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.umutcyilmaz.bloom",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F8F4EE",
    },
  },
  web: {
    bundler: "metro",
  },
  plugins: ["expo-router"],
  extra: {
    router: {
      root: "app",
    },
  },
});
