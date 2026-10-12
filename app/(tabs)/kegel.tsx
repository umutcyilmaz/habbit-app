import { Redirect } from "expo-router";
import { routes } from "../../src/constants/navigation";
export default function KegelTabRoute() { return <Redirect href={routes.kegel} />; }
