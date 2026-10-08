import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import { AppButton } from "../../shared/components/v4/AppButton";
import { AppCard } from "../../shared/components/v4/AppCard";
import { AppScreen } from "../../shared/components/v4/AppScreen";
import { AppText } from "../../shared/components/v4/AppText";
import { theme } from "../../shared/design-system/v4/theme";

export function ProductOnboardingIntroScreen() {
  const router = useRouter();
  const { durableState, hydrationStatus } = useBloomLocalState();
  const ready = hydrationStatus === "ready";
  const onboarding = durableState.productOnboarding;
  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID="bloom.onboarding.intro" style={styles.page}>
        <AppText variant="overline" tone="accent">BLOOM İLE BAŞLA</AppText>
        <View style={styles.hero}>
          <AppText variant="display" accessibilityRole="header">Sana uygun bir başlangıç bulalım.</AppText>
          <AppText variant="bodyLarge" tone="secondary">12 kısa soruya verdiğin yanıtlara göre bir başlangıç yolu önereceğiz. Öneriyi görüp başlamak isteyip istemediğine sen karar verirsin.</AppText>
        </View>
        <AppCard variant="hero" style={styles.card}>
          <AppText variant="heading2">Neler soracağız?</AppText>
          <AppText tone="secondary">Son haftalardaki içerik kullanımı, mastürbasyon deneyimin ve fark ettiğin değişiklikler.</AppText>
          <AppText tone="secondary">Bu bir tanı veya tıbbi değerlendirme değildir. Emin olmadığın sorularda bunu belirtebilirsin.</AppText>
        </AppCard>
        <AppCard style={styles.card}>
          <AppText variant="label">Yanıtların sana ait</AppText>
          <AppText variant="bodySmall" tone="secondary">Yanıtların ve önerin bu cihazda, uygulamanın yerel depolama alanında saklanır. Ayarlar’daki Veri Kontrolleri bölümünden yerel verilerini silebilirsin.</AppText>
        </AppCard>
        {ready && onboarding.status === "completed" ? (
          <AppButton testID="bloom.onboarding.result-navigation" label="Başlangıç önerine geç" onPress={() => router.replace(onboarding.planAcceptance === null ? "/bloom/starting-recommendation" : routes.home)} />
        ) : (
          <AppButton testID="bloom.onboarding.start" label="Sorulara başla" disabled={!ready} onPress={() => router.push(routes.onboardingQuiz)} />
        )}
        {!ready ? <AppText testID="bloom.onboarding.loading" tone="secondary">{hydrationStatus === "error" ? "Yerel kayıtlar şu anda açılamıyor." : "Yerel kayıtlar yükleniyor…"}</AppText> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 480, alignSelf: "center", gap: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  hero: { gap: theme.spacing.md },
  card: { gap: theme.spacing.md }
});
