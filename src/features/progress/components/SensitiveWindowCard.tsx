import type { GentleInsight } from "../types";
import { GentleInsightCard } from "./GentleInsightCard";

type SensitiveWindowCardProps = {
  insight: GentleInsight;
};

export function SensitiveWindowCard({ insight }: SensitiveWindowCardProps) {
  return <GentleInsightCard insight={insight} />;
}
