import { AppStateCard } from "./AppStateCard";
import type { EmptyStateAction } from "../../types/appState";

type ComingNextCardProps = {
  title?: string;
  body?: string;
  action?: EmptyStateAction;
};

export function ComingNextCard({
  title = "Coming next",
  body = "This support tool is planned for a future version.",
  action
}: ComingNextCardProps) {
  return (
    <AppStateCard
      variant="comingNext"
      title={title}
      body={body}
      {...(action ? { action } : {})}
    />
  );
}
