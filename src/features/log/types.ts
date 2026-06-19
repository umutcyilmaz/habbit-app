import type { LogEntry } from "../../domain/models";

export type LogDraft = Partial<LogEntry> & {
  type: LogEntry["type"];
};
