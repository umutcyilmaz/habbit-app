import { useRouter } from "expo-router";

import { routes } from "../../src/constants/navigation";
import { ModulePlaceholderScreen } from "../../src/shared/components/ModulePlaceholderScreen";

export default function PauseFallbackRoute() {
  const router = useRouter();

  return (
    <ModulePlaceholderScreen
      title="Pause"
      purpose="A short support flow for creating space before the next choice."
      responsibilities={["90-Second Pause", "Breathing guide", "After-pause reflection"]}
      primaryAction="Back to Today"
      onPrimaryAction={() => router.replace(routes.home)}
    />
  );
}
