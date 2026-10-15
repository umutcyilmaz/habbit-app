import { useCallback } from "react";
import { useRouter } from "expo-router";
import { UrgeExercise } from "../exercise/UrgeExercise";

export { UrgeExerciseText as UrgePreviewText } from "../exercise/UrgeExercise";

export function UrgePreviewScreen({ completionFixture = false }: { completionFixture?: boolean }) {
  const router = useRouter();
  const closePreview = useCallback(() => router.replace("/today"), [router]);
  return <UrgeExercise
    testIDPrefix="urge.preview"
    allowDurationSelection={!completionFixture}
    notice="QA önizleme · Kaydedilmez"
    reducedMotionNotice="QA · Hareket azaltma açık"
    {...(completionFixture ? { initialDurationMs:2_000, fixtureNotice:"QA: 2 saniyelik bitiş denemesi" } : {})}
    closeAccessibilityLabel="Önizlemeden çık"
    completionAnnouncement="Süre doldu. Hiçbir sonuç kaydedilmedi."
    completionNote="Hiçbir sonuç kayda geçmedi."
    completionActionLabel="Önizlemeyi kapat"
    exitDescription="Sayaç durdu. Çıkarsan bu önizleme kapanır. Kayıt yok."
    exitConfirmLabel="Çık ve kapat"
    onExitConfirmed={closePreview}
  />;
}
