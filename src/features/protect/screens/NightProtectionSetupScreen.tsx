import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppDispatch } from "../../../app/providers/DemoAppStateProvider";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ProtectionFlowHeader } from "../components/ProtectionFlowHeader";
import { ProtectionModeCard } from "../components/ProtectionModeCard";
import { ProtectionSetupSection } from "../components/ProtectionSetupSection";

export function NightProtectionSetupScreen() {
  const router = useRouter();
  const dispatch = useDemoAppDispatch();
  const { enableProtection } = useBloomLocalState();
  const [putPhoneAwayEnabled, setPutPhoneAwayEnabled] = useState(true);
  const [dimScreenEnabled, setDimScreenEnabled] = useState(true);

  const startNightProtection = () => {
    dispatch({
      type: "SET_PROTECTION_STATUS",
      payload: "active"
    });
    enableProtection({ preferredWindow: "night" });
    router.replace(routes.protectActive);
  };

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Night Protection Setup"
        subtitle="A softer support plan for bedtime and nighttime urges."
        onBackPress={() => router.replace(routes.protect)}
      />

      <View style={styles.stack}>
        <ProtectionSetupSection title="Bedtime support">
          <View style={styles.optionStack}>
            <ProtectionModeCard title="Start before bed" value="30 min" iconLabel="B" />
            <ProtectionModeCard
              title="Put phone away"
              value={putPhoneAwayEnabled ? "Enabled" : "Off"}
              iconLabel="P"
              enabled={putPhoneAwayEnabled}
              onPress={() => setPutPhoneAwayEnabled((isEnabled) => !isEnabled)}
            />
            <ProtectionModeCard
              title="Dim the screen"
              value={dimScreenEnabled ? "Enabled" : "Off"}
              iconLabel="D"
              enabled={dimScreenEnabled}
              onPress={() => setDimScreenEnabled((isEnabled) => !isEnabled)}
            />
            <ProtectionModeCard title="Protect until" value="7:00 AM" iconLabel="7" />
          </View>
        </ProtectionSetupSection>

        <AppButton onPress={startNightProtection}>Start Night Protection</AppButton>
        <AppText variant="bodySmall" tone="secondary" align="center">
          You can adjust these settings anytime.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  focusedContent: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  optionStack: {
    gap: theme.spacing.md
  }
});
