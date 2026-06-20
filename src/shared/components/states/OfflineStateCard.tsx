import { AppStateCard } from "./AppStateCard";
import type { EmptyStateAction } from "../../types/appState";

type OfflineStateCardProps = {
  title?: string;
  body?: string;
  action?: EmptyStateAction;
};

export function OfflineStateCard({
  title = "A gentle pause",
  body = "It seems we are offline right now. You can continue without saving, or try again later.",
  action
}: OfflineStateCardProps) {
  return <AppStateCard variant="offline" title={title} body={body} {...(action ? { action } : {})} />;
}
