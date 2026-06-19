import type { ProtectionWindow } from "../../domain/models";

export interface ProtectionWindowDraft {
  label: ProtectionWindow["label"];
  daysOfWeek: ProtectionWindow["daysOfWeek"];
  startTimeLocal: ProtectionWindow["startTimeLocal"];
  endTimeLocal: ProtectionWindow["endTimeLocal"];
  supportStyle: ProtectionWindow["supportStyle"];
}
