import Svg, { Path } from "react-native-svg";
// Native SVG paths from the local Bloom Home reference.
const paths = {
  clock: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v6l5 3 1-1.6-4-2.4V7z",
  drop: "M12 2s-7 7.7-7 12.6A7 7 0 0 0 12 22a7 7 0 0 0 7-7.4C19 9.7 12 2 12 2z",
  calendar: "M7 2h2v2h6V2h2v2h2.5A1.5 1.5 0 0 1 21 5.5v14A2.5 2.5 0 0 1 18.5 22h-13A2.5 2.5 0 0 1 3 19.5v-14A1.5 1.5 0 0 1 4.5 4H7zm-2 8v9.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V10z",
  flag: "M5 2.5h2V22H5zM8 3.5h12l-3 4.5 3 4.5H8z",
  stack: "m12 2 10 5-10 5L2 7zM2 12l2.6-1.3L12 14.4l7.4-3.7L22 12l-10 5zm0 5 2.6-1.3L12 19.4l7.4-3.7L22 17l-10 5z",
};
export type HomeIconName = keyof typeof paths;
export function HomeIcon({ name }: { name: HomeIconName }) {
  return <Svg accessible={false} width={15} height={15} viewBox="0 0 24 24"><Path d={paths[name]} fill="#fff" /></Svg>;
}
