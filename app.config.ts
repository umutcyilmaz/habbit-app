import type { ConfigContext, ExpoConfig } from "expo/config";

import appConfigJson from "./src/app/config/appConfig.json";

const defaultApplicationIdentity = {
  name: appConfigJson.APP_NAME,
  scheme: "tms",
  iosBundleIdentifier: "com.umutcyilmaz.bloom"
} as const;

const e2eApplicationIdentity = {
  name: "Bloom E2E",
  scheme: "tms-e2e",
  iosBundleIdentifier: "com.umutcyilmaz.bloom.e2e",
  androidPackage: "com.umutcyilmaz.bloom.e2e"
} as const;

function resolveApplicationIdentity(appVariant: string | undefined) {
  return appVariant === "e2e"
    ? e2eApplicationIdentity
    : defaultApplicationIdentity;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const applicationIdentity = resolveApplicationIdentity(
    process.env.APP_VARIANT
  );

  return {
    ...config,
    name: applicationIdentity.name,
    slug: "tms",
    scheme: applicationIdentity.scheme,
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: true,
      bundleIdentifier: applicationIdentity.iosBundleIdentifier,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#F8F4EE",
      },
      ...(applicationIdentity === e2eApplicationIdentity
        ? { package: applicationIdentity.androidPackage }
        : {}),
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
  };
};
