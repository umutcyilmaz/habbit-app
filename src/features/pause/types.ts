import type { PauseSession } from "../../domain/models";

export interface PauseDraft {
  durationSeconds: PauseSession["durationSeconds"];
  contextTags: PauseSession["contextTags"];
  source: PauseSession["source"];
}
