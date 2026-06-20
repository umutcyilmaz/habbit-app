import { AppStateCard } from "./AppStateCard";
import type { EmptyStateAction } from "../../types/appState";

type LowDataStateCardProps = {
  title?: string;
  body?: string;
  action?: EmptyStateAction;
};

export function LowDataStateCard({
  title = "Growth takes time",
  body = "Complete a few check-ins to see your first pattern.",
  action
}: LowDataStateCardProps) {
  return <AppStateCard variant="lowData" title={title} body={body} {...(action ? { action } : {})} />;
}
