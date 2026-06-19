import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import type {
  FamiliarPatternId,
  OnboardingDraft,
  OnboardingGoalId,
  OnboardingStepId,
  OnboardingSupportStyle,
  TriggerId
} from "./types";

type OnboardingContextValue = {
  draft: OnboardingDraft;
  setCurrentStep: (stepId: OnboardingStepId) => void;
  toggleGoal: (goalId: OnboardingGoalId) => void;
  setFamiliarPattern: (patternId: FamiliarPatternId) => void;
  toggleTrigger: (triggerId: TriggerId) => void;
  setSupportStyle: (supportStyle: OnboardingSupportStyle) => void;
};

const initialDraft: OnboardingDraft = {
  currentStepId: "welcome",
  selectedGoals: [],
  triggers: [],
  supportStyle: "balanced"
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);

  const setCurrentStep = useCallback((stepId: OnboardingStepId) => {
    setDraft((current) => {
      if (current.currentStepId === stepId) {
        return current;
      }

      return { ...current, currentStepId: stepId };
    });
  }, []);

  const toggleGoal = useCallback((goalId: OnboardingGoalId) => {
    setDraft((current) => {
      const selectedGoals = current.selectedGoals.includes(goalId)
        ? current.selectedGoals.filter((id) => id !== goalId)
        : [...current.selectedGoals, goalId];

      return { ...current, selectedGoals };
    });
  }, []);

  const setFamiliarPattern = useCallback((patternId: FamiliarPatternId) => {
    setDraft((current) => ({ ...current, familiarPattern: patternId }));
  }, []);

  const toggleTrigger = useCallback((triggerId: TriggerId) => {
    setDraft((current) => {
      const triggers = current.triggers.includes(triggerId)
        ? current.triggers.filter((id) => id !== triggerId)
        : [...current.triggers, triggerId];

      return { ...current, triggers };
    });
  }, []);

  const setSupportStyle = useCallback((supportStyle: OnboardingSupportStyle) => {
    setDraft((current) => ({ ...current, supportStyle }));
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      setCurrentStep,
      toggleGoal,
      setFamiliarPattern,
      toggleTrigger,
      setSupportStyle
    }),
    [draft, setCurrentStep, setFamiliarPattern, setSupportStyle, toggleGoal, toggleTrigger]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }

  return context;
}
