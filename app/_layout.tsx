import { useEffect } from "react";
import { BloomGuardedStack as Stack } from "../src/shared/navigation/BloomGuardedNavigators";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { AppProviders } from "../src/app/providers/AppProviders";
import { theme } from "../src/shared/design-system/theme";
import { fonts } from "../src/shared/design-system/fonts";
import { BloomNestedBackButton } from "../src/shared/navigation/BloomNestedBackButton";
import { useReducedMotion } from "react-native-reanimated";

const settingsHeaders = [
  ["settings/index", "Ayarlar"], ["settings/privacy", "Gizlilik"],
  ["settings/data-controls", "Veri kontrolleri"], ["settings/notifications", "Bildirimler"],
  ["settings/app-lock", "Uygulama kilidi"], ["settings/subscription", "Abonelik"]
] as const;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const reduced=useReducedMotion();
  const [fontsLoaded, fontError] = useFonts(fonts);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
          headerShown: false,
        }}
      >
        <Stack.Screen name="bloom/profile/saved" options={{animation:reduced ? "none" : "slide_from_right"}} />
        <Stack.Screen name="bloom/library/category" options={{animation:reduced ? "none" : "slide_from_right"}} />
        <Stack.Screen name="bloom/library/sound" options={{animation:reduced ? "none" : "slide_from_right"}} />
        <Stack.Screen name="bloom/library/article" options={{animation:reduced ? "none" : "slide_from_right"}} />
        <Stack.Screen name="bloom/kegel" options={{animation:reduced ? "none" : "fade"}} />
        {settingsHeaders.map(([name,title])=><Stack.Screen key={name} name={name} options={{
          title,headerShown:true,headerStyle:{backgroundColor:"#0e0e10"},headerTintColor:"#fff",
          headerBackVisible:false,headerLeft:()=> <BloomNestedBackButton />
        }} />)}
      </Stack>
    </AppProviders>
  );
}
