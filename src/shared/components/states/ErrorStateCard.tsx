import { AppStateCard } from "./AppStateCard";
import type { EmptyStateAction } from "../../types/appState";

type ErrorStateCardProps = {
  title?: string;
  body?: string;
  action?: EmptyStateAction;
};

export function ErrorStateCard({
  title = "A gentle pause",
  body = "Something needs another moment. You can continue at your own pace.",
  action
}: ErrorStateCardProps) {
  return <AppStateCard variant="error" title={title} body={body} {...(action ? { action } : {})} />;
}
