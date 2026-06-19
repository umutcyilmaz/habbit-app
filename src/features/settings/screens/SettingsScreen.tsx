import { useRouter } from "expo-router";

import { modulePlaceholders } from "../../../constants/copy";
import { routes } from "../../../constants/navigation";
import { ModulePlaceholderScreen } from "../../../shared/components/ModulePlaceholderScreen";

export function SettingsScreen() {
  const router = useRouter();

  return (
    <ModulePlaceholderScreen
      {...modulePlaceholders.settings}
      showSettingsAction={false}
      onPrimaryAction={() => router.replace(routes.home)}
    />
  );
}
