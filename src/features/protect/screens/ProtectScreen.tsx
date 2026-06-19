import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ProtectExplanationCard } from "../components/ProtectExplanationCard";
import { ProtectedWindowPreview } from "../components/ProtectedWindowPreview";
import { ProtectionScheduleCard } from "../components/ProtectionScheduleCard";
import { ProtectionStatusCard } from "../components/ProtectionStatusCard";
import { SensitiveWindowCard } from "../components/SensitiveWindowCard";
import {
  defaultProtectionLevel,
  defaultProtectionSchedule,
  suggestedSensitiveWindow
} from "../data/protectMockData";
import type {
  ProtectedWindowAction,
  ProtectionLevel,
  ProtectionSchedule,
  ProtectionStatus
} from "../types";

export function ProtectScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ProtectionStatus>("suggested");
  const [schedule] = useState<ProtectionSchedule>(defaultProtectionSchedule);
  const [level, setLevel] = useState<ProtectionLevel>(defaultProtectionLevel);
  const [showPreview, setShowPreview] = useState(false);
  const [choiceMessage, setChoiceMessage] = useState<string | undefined>();

  const handlePreviewAction = (action: ProtectedWindowAction) => {
    if (action === "startPause") {
      router.push(routes.pause);
      return;
    }

    if (action === "quickCheckIn") {
      router.push(routes.log);
      return;
    }

    if (action === "continueMindfully") {
      setChoiceMessage("Choice noted. Take your time.");
      return;
    }

    setShowPreview(false);
    setChoiceMessage(undefined);
  };

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader
          title="Protect"
          subtitle="Gentle support during sensitive windows."
          onSettingsPress={() => router.push(routes.settings)}
        />

        <ProtectExplanationCard />

        {status === "suggested" ? (
          <SensitiveWindowCard
            window={suggestedSensitiveWindow}
            onSetup={() => setStatus("setup")}
            onNotNow={() => setStatus("off")}
          />
        ) : null}

        {status === "setup" ? (
          <ProtectionScheduleCard
            schedule={schedule}
            level={level}
            onLevelChange={setLevel}
            onSave={() => {
              setStatus("active");
              setShowPreview(false);
              setChoiceMessage(undefined);
              // TODO: Persist support window settings when local storage repositories exist.
            }}
            onCancel={() => setStatus("suggested")}
          />
        ) : null}

        {status === "active" ? (
          <ProtectionStatusCard
            schedule={schedule}
            level={level}
            onPreview={() => {
              setChoiceMessage(undefined);
              setShowPreview(true);
            }}
            onChangeLevel={() => setStatus("setup")}
            onPauseTonight={() => {
              setStatus("paused");
              setShowPreview(false);
            }}
            onTurnOff={() => {
              setStatus("off");
              setShowPreview(false);
            }}
          />
        ) : null}

        {status === "paused" ? (
          <AppCard>
            <View style={styles.cardContent}>
              <AppText variant="title">Support paused for tonight</AppText>
              <AppText tone="secondary">No problem. Your plan can continue tomorrow.</AppText>
              <View style={styles.actions}>
                <AppButton onPress={() => setStatus("active")}>Turn back on</AppButton>
                <AppButton variant="secondary" onPress={() => setChoiceMessage("Kept paused tonight.")}>
                  Keep paused tonight
                </AppButton>
              </View>
              {choiceMessage ? (
                <AppText variant="bodySmall" tone="secondary">
                  {choiceMessage}
                </AppText>
              ) : null}
            </View>
          </AppCard>
        ) : null}

        {status === "off" ? (
          <AppCard>
            <View style={styles.cardContent}>
              <AppText variant="title">Sensitive Window Support is off</AppText>
              <AppText tone="secondary">You can turn it back on anytime.</AppText>
              <View style={styles.actions}>
                <AppButton onPress={() => setStatus("setup")}>Turn Support On</AppButton>
                <AppButton variant="secondary" onPress={() => router.push(routes.home)}>
                  Back to Today
                </AppButton>
              </View>
            </View>
          </AppCard>
        ) : null}

        {showPreview ? (
          <ProtectedWindowPreview
            schedule={schedule}
            {...(choiceMessage !== undefined ? { choiceMessage } : {})}
            onAction={handlePreviewAction}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  cardContent: {
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  }
});
