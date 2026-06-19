import { Redirect } from "expo-router";

export default function IndexRoute() {
  // TODO: Redirect to Today after onboarding completion is persisted locally.
  return <Redirect href="/onboarding/welcome" />;
}
