import type { ProtectionWindow } from "../../domain/models";
import type { DemoSupportLevel } from "../../domain/demo/demoTypes";

export interface ProtectionWindowDraft {
  label: ProtectionWindow["label"];
  daysOfWeek: ProtectionWindow["daysOfWeek"];
  startTimeLocal: ProtectionWindow["startTimeLocal"];
  endTimeLocal: ProtectionWindow["endTimeLocal"];
  supportStyle: ProtectionWindow["supportStyle"];
}

export type ProtectionSchedule = "night" | "custom" | "alwaysOn";

export type ProtectionLevelOption = {
  id: DemoSupportLevel;
  title: string;
  description: string;
};

export type ProtectionScheduleOption = {
  id: ProtectionSchedule;
  title: string;
  description: string;
};
