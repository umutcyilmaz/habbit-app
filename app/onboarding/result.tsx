import { Redirect } from "expo-router";
import { useBloomLocalState } from "../../src/app/providers/BloomLocalStateProvider";
import { productOnboardingEntryRoute } from "../../src/features/product-onboarding/productOnboardingRoute";
import { AppScreen } from "../../src/shared/components/v4/AppScreen";
import { AppText } from "../../src/shared/components/v4/AppText";

export default function OnboardingResultRoute() {
  const { durableState, hydrationStatus } = useBloomLocalState();
  if (hydrationStatus !== "ready") return <AppScreen testID="bloom.onboarding.result.loading"><AppText>Kaydedilmiş yanıtlar yükleniyor…</AppText></AppScreen>;
  return <Redirect href={productOnboardingEntryRoute(durableState.productOnboarding)} />;
}
