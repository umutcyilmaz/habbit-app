import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { debugToolsEnabled } from "../../../shared/runtime/debugTools";
import {
  calculateQuizResultPreview,
  frequencyAnswers,
  getPatternLabel,
  getQuizQuestionContribution,
  getRecommendedFirstActionLabel,
  quizQuestions,
  scoreOnboardingQuiz,
  triggerOptions,
  type FrequencyAnswerValue,
  type QuizAnswerMap,
  type QuizQuestion,
  type TriggerOptionId
} from "../quiz";

const totalQuestions = quizQuestions.length;
const previewScoreAreas = ["PL", "PP", "CT", "FC"] as const;
const frequencyAnswerTestIds: Record<FrequencyAnswerValue, string> = {
  0: "bloom.quiz.answer.never",
  1: "bloom.quiz.answer.sometimes",
  2: "bloom.quiz.answer.often",
  3: "bloom.quiz.answer.very-often"
};

export function OnboardingQuizScreen() {
  const router = useRouter();
  const { saveOnboardingResult } = useBloomLocalState();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswerMap>({});
  const currentQuestion = quizQuestions[stepIndex] ?? quizQuestions[0];

  if (currentQuestion === undefined) {
    return null;
  }

  const progress = (stepIndex + 1) / totalQuestions;
  const canContinue = canContinueQuestion(currentQuestion, answers);
  const isLastQuestion = stepIndex === totalQuestions - 1;

  const finishQuiz = (finalAnswers: QuizAnswerMap) => {
    const result = scoreOnboardingQuiz(finalAnswers);
    saveOnboardingResult(finalAnswers, result);
    router.replace(routes.onboardingResult);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      router.replace(routes.onboarding);
      return;
    }

    setStepIndex((current) => current - 1);
  };

  const continueFlow = () => {
    if (!isLastQuestion) {
      setStepIndex((current) => current + 1);
      return;
    }

    finishQuiz(answers);
  };

  const skipTriggers = () => {
    const nextAnswers = {
      ...answers,
      loop_triggers: []
    };

    setAnswers(nextAnswers);

    if (isLastQuestion) {
      finishQuiz(nextAnswers);
      return;
    }

    setStepIndex((current) => Math.min(current + 1, totalQuestions - 1));
  };

  const clearQuizAnswers = () => {
    setAnswers({});
    setStepIndex(0);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <QuizHeader
        stepIndex={stepIndex}
        progress={progress}
        onBackPress={goBack}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <QuestionContent
          question={currentQuestion}
          answers={answers}
          onAnswerChange={setAnswers}
        />

        <View style={styles.actionStack}>
          <AppButton
            testID="bloom.quiz.continue"
            disabled={!canContinue}
            onPress={continueFlow}
          >
            {isLastQuestion ? "See my plan" : "Continue"}
          </AppButton>
          {currentQuestion.type === "multiSelect" ? (
            <Pressable accessibilityRole="button" onPress={skipTriggers} style={styles.textAction}>
              <AppText variant="label" tone="secondary" align="center">
                Skip
              </AppText>
            </Pressable>
          ) : null}
          {currentQuestion.type === "frequency" ? (
            <AppText variant="bodySmall" tone="secondary" align="center">
              There are no right or wrong answers.
            </AppText>
          ) : null}
        </View>

        {debugToolsEnabled ? (
          <TestScoringPreviewPanel
            question={currentQuestion}
            answers={answers}
            onClearAnswers={clearQuizAnswers}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

type QuizHeaderProps = {
  stepIndex: number;
  progress: number;
  onBackPress: () => void;
  onClosePress: () => void;
};

function QuizHeader({ stepIndex, progress, onBackPress, onClosePress }: QuizHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <AppIconButton
          accessibilityLabel="Go back"
          icon={<AppText variant="title">‹</AppText>}
          onPress={onBackPress}
          style={styles.headerButton}
        />
        <View style={styles.headerLabelWrap}>
          <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
            QUESTION {stepIndex + 1} OF {totalQuestions}
          </AppText>
        </View>
        <AppIconButton
          accessibilityLabel="Close quiz"
          icon={<AppText variant="title">×</AppText>}
          onPress={onClosePress}
          style={styles.headerButton}
        />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

type QuestionContentProps = {
  question: QuizQuestion;
  answers: QuizAnswerMap;
  onAnswerChange: (updater: (answers: QuizAnswerMap) => QuizAnswerMap) => void;
};

function QuestionContent({ question, answers, onAnswerChange }: QuestionContentProps) {
  if (question.type === "multiSelect") {
    return (
      <QuestionShell question={question.question} subtitle={question.subtitle}>
        <TriggerMultiSelect
          selected={getSelectedTriggers(answers.loop_triggers)}
          onChange={(selected) =>
            onAnswerChange((current) => ({
              ...current,
              loop_triggers: selected
            }))
          }
        />
      </QuestionShell>
    );
  }

  return (
    <QuestionShell question={question.question}>
      <FrequencySelect
        selected={getSelectedFrequencyAnswer(answers[question.id])}
        onChange={(selected) =>
          onAnswerChange((current) => ({
            ...current,
            [question.id]: selected
          }))
        }
      />
    </QuestionShell>
  );
}

type QuestionShellProps = {
  question: string;
  subtitle?: string;
  children: ReactNode;
};

function QuestionShell({ question, subtitle, children }: QuestionShellProps) {
  return (
    <View style={styles.questionShell}>
      <View style={styles.questionCopy}>
        <AppText variant="heading" style={styles.questionTitle}>
          {question}
        </AppText>
        {subtitle ? (
          <AppText tone="secondary" style={styles.questionSubtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

type FrequencySelectProps = {
  selected: FrequencyAnswerValue | null;
  onChange: (value: FrequencyAnswerValue) => void;
};

function FrequencySelect({ selected, onChange }: FrequencySelectProps) {
  return (
    <View style={styles.answerStack}>
      {frequencyAnswers.map((answer) => (
        <SelectableCard
          key={answer.label}
          testID={frequencyAnswerTestIds[answer.value]}
          selected={selected === answer.value}
          title={answer.label}
          onPress={() => onChange(answer.value)}
        />
      ))}
    </View>
  );
}

type TriggerMultiSelectProps = {
  selected: TriggerOptionId[];
  onChange: (selected: TriggerOptionId[]) => void;
};

function TriggerMultiSelect({ selected, onChange }: TriggerMultiSelectProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (id: TriggerOptionId) => {
    if (id === "notSure") {
      onChange(selectedSet.has(id) ? [] : ["notSure"]);
      return;
    }

    const next = new Set(selected.filter((item) => item !== "notSure"));

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    onChange(Array.from(next));
  };

  return (
    <View style={styles.chipGrid}>
      {triggerOptions.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedSet.has(option.id) }}
          onPress={() => toggle(option.id)}
          style={({ pressed }) => [
            styles.triggerChip,
            selectedSet.has(option.id) ? styles.selectedSurface : undefined,
            pressed ? styles.pressedSurface : undefined
          ]}
        >
          <AppText variant="label" align="center">
            {option.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

type SelectableCardProps = {
  testID: string;
  selected: boolean;
  title: string;
  body?: string;
  icon?: string;
  onPress: () => void;
};

function SelectableCard({ testID, selected, title, body, icon, onPress }: SelectableCardProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectableCard,
        selected ? styles.selectedSurface : undefined,
        pressed ? styles.pressedSurface : undefined
      ]}
    >
      <View style={styles.selectableRow}>
        {icon ? (
          <View style={styles.optionIcon}>
            <AppText variant="label">{icon}</AppText>
          </View>
        ) : null}
        <View style={styles.selectableCopy}>
          <AppText variant="label">{title}</AppText>
          {body ? (
            <AppText variant="bodySmall" tone="secondary">
              {body}
            </AppText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

type TestScoringPreviewPanelProps = {
  question: QuizQuestion;
  answers: QuizAnswerMap;
  onClearAnswers: () => void;
};

function TestScoringPreviewPanel({
  question,
  answers,
  onClearAnswers
}: TestScoringPreviewPanelProps) {
  const preview = calculateQuizResultPreview(answers);
  const contribution = getQuizQuestionContribution(question, answers);
  const result = preview.result;
  const isEarlyPreview = result !== null && !preview.isComplete;

  return (
    <AppCard style={styles.debugCard}>
      <View style={styles.debugStack}>
        <View style={styles.debugHeader}>
          <View style={styles.debugHeaderCopy}>
            <AppText variant="label">Test scoring preview</AppText>
            <AppText variant="caption" tone="secondary">
              Visible during testing only.
            </AppText>
          </View>
          {isEarlyPreview ? (
            <View style={styles.debugPill}>
              <AppText variant="caption" tone="secondary">
                Early preview
              </AppText>
            </View>
          ) : null}
        </View>

        <DebugSection title="Current question contribution">
          <View style={styles.debugMiniStack}>
            <AppText variant="bodySmall" tone="secondary">
              {question.type === "multiSelect" ? "Selected triggers" : "Selected answer"}:{" "}
              {contribution.selectedLabels.length > 0
                ? contribution.selectedLabels.join(", ")
                : "None"}
            </AppText>
            {contribution.scoreContributions.length > 0 ? (
              <ContributionWrap contributions={contribution.scoreContributions} />
            ) : (
              <AppText variant="bodySmall">{contribution.note}</AppText>
            )}
            {contribution.flags.length > 0 ? (
              <FlagWrap flags={contribution.flags} />
            ) : null}
          </View>
        </DebugSection>

        <DebugSection title="Running raw scores">
          <ScoreRows
            scores={previewScoreAreas.map((area) => ({
              label: area,
              value: formatScore(preview.scores[area])
            }))}
          />
        </DebugSection>

        <DebugSection title="Running normalized scores">
          <ScoreRows
            scores={previewScoreAreas.map((area) => ({
              label: area,
              value: formatPercent(preview.normalizedScores[area])
            }))}
          />
        </DebugSection>

        <DebugSection title="Current predicted result">
          <View style={styles.debugMiniStack}>
            {result === null ? (
              <>
                <AppText variant="label">Not enough answers yet</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Answer a few more questions to see an early preview.
                </AppText>
              </>
            ) : (
              <>
                {isEarlyPreview ? (
                  <AppText variant="bodySmall" tone="secondary">
                    Early preview - may change as you answer more questions.
                  </AppText>
                ) : null}
                <DebugInfoRow
                  label="Predicted profile"
                  value={
                    isEarlyPreview && result.primaryPattern === "generalStartingPoint"
                      ? "General starting point - early preview"
                      : result.resultTitle
                  }
                />
                <DebugInfoRow
                  label="Primary"
                  value={getPatternLabel(result.primaryPattern)}
                />
                <DebugInfoRow
                  label="Secondary"
                  value={
                    result.secondaryPattern
                      ? getPatternLabel(result.secondaryPattern)
                      : "None"
                  }
                />
                <DebugInfoRow
                  label="Recommended first action"
                  value={getRecommendedFirstActionLabel(result.recommendedFirstAction)}
                />
              </>
            )}
            <AppText variant="caption" tone="secondary">
              Answered {preview.answeredStepCount} of {preview.totalSteps} steps ·{" "}
              {preview.answeredFrequencyCount} frequency answers
            </AppText>
          </View>
        </DebugSection>

        <DebugSection title="Flags">
          {preview.activeFlags.length > 0 ? (
            <FlagWrap flags={preview.activeFlags} />
          ) : (
            <AppText variant="bodySmall">No flags yet.</AppText>
          )}
        </DebugSection>

        <Pressable accessibilityRole="button" onPress={onClearAnswers} style={styles.clearDebugAction}>
          <AppText variant="label" tone="secondary" align="center">
            Clear quiz answers
          </AppText>
        </Pressable>
      </View>
    </AppCard>
  );
}

type DebugSectionProps = {
  title: string;
  children: ReactNode;
};

function DebugSection({ title, children }: DebugSectionProps) {
  return (
    <View style={styles.debugSection}>
      <AppText variant="caption" tone="secondary" style={styles.debugSectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

type ContributionWrapProps = {
  contributions: Array<{
    area: (typeof previewScoreAreas)[number];
    value: number;
  }>;
};

function ContributionWrap({ contributions }: ContributionWrapProps) {
  return (
    <View style={styles.debugChipWrap}>
      {contributions.map((contribution) => (
        <View key={contribution.area} style={styles.debugChip}>
          <AppText variant="caption">
            {contribution.area} +{formatScore(contribution.value)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

type FlagWrapProps = {
  flags: string[];
};

function FlagWrap({ flags }: FlagWrapProps) {
  return (
    <View style={styles.debugChipWrap}>
      {flags.map((flag) => (
        <View key={flag} style={styles.debugFlagChip}>
          <AppText variant="caption">{flag}</AppText>
        </View>
      ))}
    </View>
  );
}

type ScoreRowsProps = {
  scores: Array<{
    label: string;
    value: string;
  }>;
};

function ScoreRows({ scores }: ScoreRowsProps) {
  return (
    <View style={styles.scoreRowWrap}>
      {scores.map((score) => (
        <View key={score.label} style={styles.scorePill}>
          <AppText variant="caption" tone="secondary">
            {score.label}
          </AppText>
          <AppText variant="label">{score.value}</AppText>
        </View>
      ))}
    </View>
  );
}

type DebugInfoRowProps = {
  label: string;
  value: string;
};

function DebugInfoRow({ label, value }: DebugInfoRowProps) {
  return (
    <View style={styles.debugInfoRow}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="bodySmall" style={styles.debugInfoValue}>
        {value}
      </AppText>
    </View>
  );
}

function canContinueQuestion(question: QuizQuestion, answers: QuizAnswerMap) {
  if (question.type === "multiSelect") {
    return true;
  }

  return getSelectedFrequencyAnswer(answers[question.id]) !== null;
}

function getSelectedFrequencyAnswer(value: unknown): FrequencyAnswerValue | null {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : null;
}

function getSelectedTriggers(value: unknown): TriggerOptionId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is TriggerOptionId =>
    triggerOptions.some((option) => option.id === item)
  );
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  header: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl
  },
  headerActions: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface
  },
  headerLabelWrap: {
    position: "absolute",
    left: 58,
    right: 58,
    alignItems: "center"
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  progressTrack: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  },
  stack: {
    gap: theme.spacing.xl
  },
  questionShell: {
    gap: theme.spacing.xl
  },
  questionCopy: {
    gap: theme.spacing.md
  },
  questionTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 34,
    lineHeight: 40
  },
  questionSubtitle: {
    fontSize: 17,
    lineHeight: 25
  },
  answerStack: {
    gap: theme.spacing.md
  },
  selectableCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  selectableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  optionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  selectableCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  triggerChip: {
    minHeight: 48,
    flexGrow: 1,
    flexBasis: "45%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  selectedSurface: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  pressedSurface: {
    opacity: 0.82
  },
  actionStack: {
    gap: theme.spacing.md
  },
  textAction: {
    paddingVertical: theme.spacing.sm
  },
  debugCard: {
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg
  },
  debugStack: {
    gap: theme.spacing.lg
  },
  debugHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  debugHeaderCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  debugPill: {
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  debugSection: {
    gap: theme.spacing.sm
  },
  debugSectionTitle: {
    textTransform: "uppercase"
  },
  debugMiniStack: {
    gap: theme.spacing.sm
  },
  debugChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs
  },
  debugChip: {
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4
  },
  debugFlagChip: {
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4
  },
  scoreRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  scorePill: {
    flexGrow: 1,
    minWidth: 68,
    gap: 2,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm
  },
  debugInfoRow: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm
  },
  debugInfoValue: {
    flexShrink: 1
  },
  clearDebugAction: {
    alignSelf: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  }
});
