import { Redirect } from "expo-router";

import { useBloomLocalState } from "../src/app/providers/BloomLocalStateProvider";
import { routes } from "../src/constants/navigation";

export default function IndexRoute() {
  const { state } = useBloomLocalState();

  if (!state.onboarding.completed) {
    return <Redirect href={routes.onboarding} />;
  }

  return <Redirect href={routes.home} />;
}
