import { AppStateCard } from "./AppStateCard";
import type { EmptyStateAction } from "../../types/appState";

type EmptyStateCardProps = {
  title?: string;
  body?: string;
  action?: EmptyStateAction;
};

export function EmptyStateCard({
  title = "Context awaits",
  body = "Nothing is wrong. The app just needs a little more context.",
  action
}: EmptyStateCardProps) {
  return <AppStateCard variant="empty" title={title} body={body} {...(action ? { action } : {})} />;
}
