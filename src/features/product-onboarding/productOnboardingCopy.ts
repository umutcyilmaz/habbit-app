import type { BloomOnboardingAnswers } from "../../domain/onboarding/types";

type QuestionCopy = { prompt: string; supportingText?: string };
export const questionCopy: Record<keyof BloomOnboardingAnswers, QuestionCopy> = {
  explicitContentFrequency: { prompt: "Son 4 haftada açık içeriği bilerek ne sıklıkla izledin?" },
  unplannedContentUse: { prompt: "Son 4 haftada başka bir şey yaparken planlamadan açık içerik açtığın ne sıklıkla oldu?" },
  activityInterruption: { prompt: "Son 4 haftada ders, iş veya günlük bir etkinliği bırakıp kısa süreliğine açık içeriğe geçtiğin ne sıklıkla oldu?" },
  contentTriggeredMasturbation: { prompt: "Son 4 haftada, başlangıçta düşünmediğin hâlde açık içerik izlemek ne sıklıkla mastürbasyona yol açtı?" },
  repeatedContentReturn: { prompt: "Son 4 haftada açık içeriği kapattıktan sonra aynı gün tekrar tekrar döndüğün ne sıklıkla oldu?" },
  difficultyReducingContent: { prompt: "Son 4 haftada açık içeriği azaltma veya izlememe kararına uymakta ne sıklıkla zorlandın?" },
  erectionQuality: { prompt: "Son 4 haftada mastürbasyon sırasında tipik ereksiyon kaliteni nasıl tanımlarsın?", supportingText: "1 çok düşük, 10 çok yüksek kaliteyi ifade eder. Net bir yanıtın yoksa Emin değilim'i seç." },
  erectionMaintenanceDifficulty: { prompt: "Son 4 haftada mastürbasyon sırasında ereksiyonu sürdürmek ne sıklıkla zor oldu?" },
  masturbationTechniques: { prompt: "Son 4 haftada mastürbasyon sırasında genellikle hangi teknikleri kullandın?", supportingText: "Uyanların tümünü seç. Emin değilim tek başına seçilir." },
  techniqueDependency: { prompt: "Son 4 haftada alıştığın basınç, hız, pozisyon veya teknik olmadan mastürbasyona devam etmek ya da bitirmek ne sıklıkla zor oldu?" },
  delayedOrDifficultEjaculation: { prompt: "Son 4 haftada mastürbasyon istediğinden çok daha uzun sürdü ya da boşalmak zor oldu mu? Ne sıklıkla?" },
  safetySignals: { prompt: "Aşağıdakilerden herhangi birini fark ettin mi?", supportingText: "Uyanların tümünü seç. Emin değilim, fark ettiğin bir durumla birlikte seçilebilir. Bunların hiçbiri tek başına seçilir." }
};

export const answerCopy: Record<string, string> = {
  never: "Hiçbir zaman", rarely: "Nadiren", sometimes: "Bazen", often: "Sık sık", almostAlways: "Neredeyse her zaman", notSure: "Emin değilim",
  lessThanWeekly: "Haftada birden az", weekly: "Yaklaşık haftada bir", severalDaysAWeek: "Haftada birkaç gün", dailyOrMore: "Her gün veya daha sık",
  neverTriedToReduce: "Azaltmayı veya bırakmayı hiç denemedim",
  normalHandTechnique: "Rahat hız ve basınçla elle uyarım", veryHighSpeed: "Çok yüksek hız", veryTightPressure: "Çok sıkı basınç",
  frictionThroughClothing: "Kıyafet üzerinden sürtünme", rubbingAgainstBedPillowSurface: "Yatak, yastık veya başka bir yüzeye sürtünme",
  proneRubbing: "Yüzüstü yatarken sürtünme", other: "Başka bir teknik",
  suddenPersistentErectionChange: "Ereksiyonda ani ve kalıcı değişim", pain: "Ağrı", numbnessOrSensationChange: "Uyuşma veya his değişikliği",
  newMarkedCurvature: "Yeni ve belirgin eğrilik", none: "Bunların hiçbiri", unsure: "Emin değilim"
};

export function labelForAnswer(value: string | number): string {
  return typeof value === "number" ? String(value) : answerCopy[value] ?? value;
}
