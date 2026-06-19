import { useRouter } from "expo-router";

import { modulePlaceholders } from "../../../constants/copy";
import { routes } from "../../../constants/navigation";
import { ModulePlaceholderScreen } from "../../../shared/components/ModulePlaceholderScreen";

export function TodayScreen() {
  const router = useRouter();

  return (
    <ModulePlaceholderScreen
      {...modulePlaceholders.today}
      onPrimaryAction={() => router.push(routes.pause)}
    />
  );
}
