import type { ReactNode } from "react";

export type AppStateVariant = "empty" | "lowData" | "error" | "offline" | "comingNext";

export type EmptyStateAction = {
  label: string;
  onPress: () => void;
};

export type AppStateCardProps = {
  variant: AppStateVariant;
  title: string;
  body: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  children?: ReactNode;
};
