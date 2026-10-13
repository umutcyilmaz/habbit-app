import Svg, { Path } from "react-native-svg";
export type ProfileIconName = "settings" | "assessment" | "report" | "saved" | "privacy" | "data" | "member";
const paths: Record<ProfileIconName, string> = {
  settings: "M10.3 2h3.4l.5 2.6 1.9 1.1 2.5-.9 1.7 3-2 1.7v2.1l2 1.7-1.7 3-2.5-.9-1.9 1.1-.5 2.5h-3.4l-.5-2.5-1.9-1.1-2.5.9-1.7-3 2-1.7v-2.1l-2-1.7 1.7-3 2.5.9 1.9-1.1zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z",
  assessment: "m12 2 10 5-10 5L2 7zm-9 9 9 4.5 9-4.5v3l-9 4.5L3 14zm0 6 9 4.5 9-4.5v3l-9 4.5L3 20z",
  report: "M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5zM7.5 12v1.8h9V12zm0 4v1.8h6V16z",
  saved: "M6 3h12v19l-6-4-6 4z",
  privacy: "M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6zm0 3v14c-4-2-6-4-6-7V8z",
  data: "M4 4h16v4H4zm0 6h16v4H4zm0 6h16v4H4z",
  member: "M3 7l4.5 3.8L12 4l4.5 6.8L21 7l-1.8 11H4.8zm2 13h14v2H5z"
};
export function ProfileIcon({name, color="#aab3ff", size=18}: {name:ProfileIconName;color?:string;size?:number}) {
  return <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24"><Path d={paths[name]} fill={color} fillRule="evenodd" /></Svg>;
}
