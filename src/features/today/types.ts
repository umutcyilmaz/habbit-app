export interface TodayAction {
  id: "quickCheckIn" | "pauseNow" | "addLog" | "startExercise";
  label: string;
  description: string;
}
