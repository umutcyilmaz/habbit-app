import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { CheckInSavedSummary } from "../components/CheckInSavedSummary";
import { LogEntrySelector } from "../components/LogEntrySelector";
import { QuickCheckInForm } from "../components/QuickCheckInForm";
import { defaultQuickCheckInValues } from "../data/logMockData";
import type {
  LogEntryOption,
  LogScreenMode,
  QuickCheckInFormState,
  QuickCheckInSummary
} from "../types";

export function LogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<LogScreenMode>("selector");
  const [comingNextOption, setComingNextOption] = useState<LogEntryOption | undefined>();
  const [formState, setFormState] = useState<QuickCheckInFormState>(defaultQuickCheckInValues);
  const [summary, setSummary] = useState<QuickCheckInSummary | undefined>();

  useEffect(() => {
    if (params.mode === "quickCheckIn") {
      setMode("quickCheckIn");
    }
  }, [params.mode]);

  const openQuickCheckIn = () => {
    setComingNextOption(undefined);
    setMode("quickCheckIn");
  };

  const handleSelectOption = (option: LogEntryOption) => {
    if (option.id === "quickCheckIn" || option.id === "nothing") {
      openQuickCheckIn();
      return;
    }

    setComingNextOption(option);
  };

  const handleSaveCheckIn = () => {
    // TODO: Persist this check-in locally once the Log repository/storage layer exists.
    setSummary({
      awarenessRating: formState.awarenessRating,
      groundedRating: formState.groundedRating,
      strongestFeeling: formState.strongestFeeling,
      supportTools: formState.supportTools
    });
    setMode("saved");
  };

  const resetToSelector = () => {
    setComingNextOption(undefined);
    setMode("selector");
  };

  return (
    <AppScreen>
      <View style={styles.stack}>
        <AppHeader
          title={getHeaderTitle(mode)}
          subtitle={getHeaderSubtitle(mode)}
          onSettingsPress={() => router.push(routes.settings)}
        />

        {mode === "selector" ? (
          <LogEntrySelector
            comingNextOption={comingNextOption}
            onSelect={handleSelectOption}
            onStartCheckIn={openQuickCheckIn}
          />
        ) : null}

        {mode === "quickCheckIn" ? (
          <QuickCheckInForm
            value={formState}
            onChange={setFormState}
            onBack={resetToSelector}
            onSave={handleSaveCheckIn}
          />
        ) : null}

        {mode === "saved" && summary ? (
          <CheckInSavedSummary
            summary={summary}
            onBackToToday={() => router.push(routes.home)}
            onViewProgress={() => router.push("/(tabs)/progress")}
            onLogAnother={resetToSelector}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

function getHeaderTitle(mode: LogScreenMode) {
  if (mode === "quickCheckIn") {
    return "Quick Check-In";
  }

  if (mode === "saved") {
    return "Check-in saved";
  }

  return "What happened today?";
}

function getHeaderSubtitle(mode: LogScreenMode) {
  if (mode === "quickCheckIn") {
    return "A short moment to notice where you are today.";
  }

  if (mode === "saved") {
    return undefined;
  }

  return "Choose the option that feels closest. You can keep this quick.";
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  }
});
