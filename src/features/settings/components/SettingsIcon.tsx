import Svg, { Path, Rect } from "react-native-svg";
import { ProfileIcon, type ProfileIconName } from "../../profile/components/ProfileIcon";

// Native paths from the local Bloom HTML reference.
const paths = {
  "lock": "M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-2.6 8V7a2.6 2.6 0 1 1 5.2 0v3z",
  "bell": "M12 2.5a6.5 6.5 0 0 0-6.5 6.5v4.2L3.8 16c-.4.6 0 1.5.8 1.5h14.8c.8 0 1.2-.9.8-1.5l-1.7-2.8V9A6.5 6.5 0 0 0 12 2.5zM9.2 19a2.9 2.9 0 0 0 5.6 0z",
  "clock": "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v6l5 3 1-1.6-4-2.4V7z",
  "calendar": "M7 2h2v2h6V2h2v2h2.5A1.5 1.5 0 0 1 21 5.5v14A2.5 2.5 0 0 1 18.5 22h-13A2.5 2.5 0 0 1 3 19.5v-14A1.5 1.5 0 0 1 4.5 4H7zm-2 8v9.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V10z",
  "wave": "M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-3 5-1",
  "trash": "M9 2h6l1 2h4v2.2H4V4h4zM5.5 8h13l-1 12.2a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8z",
  "help": "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-.1 13.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM12 6c-2.2 0-3.8 1.3-3.9 3.3h2.3c.1-.8.7-1.3 1.6-1.3s1.5.5 1.5 1.2c0 .6-.3 1-1.2 1.6-1 .6-1.5 1.3-1.4 2.5v.6h2.2V13c0-.6.3-.9 1.2-1.5 1-.6 1.6-1.4 1.6-2.6C15.9 7.2 14.3 6 12 6z"
} as const;
export type SettingsIconName = ProfileIconName | keyof typeof paths | "app";
export function SettingsIcon({ name, color }: { name: SettingsIconName; color: string }) {
  if (name === "app") return <Svg accessible={false} width={18} height={18} viewBox="0 0 24 24"><Rect x={3} y={3} width={18} height={18} rx={5} fill={color} /></Svg>;
  if (name in paths) return <Svg accessible={false} width={18} height={18} viewBox="0 0 24 24"><Path d={paths[name as keyof typeof paths]} fill={name === "wave" ? "none" : color} stroke={name === "wave" ? color : "none"} strokeWidth={2.4} strokeLinecap="round" /></Svg>;
  return <ProfileIcon name={name as ProfileIconName} color={color} />;
}
