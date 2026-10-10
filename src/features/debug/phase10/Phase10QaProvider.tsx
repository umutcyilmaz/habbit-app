import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AppText } from "../../../shared/components/AppText";
import { storageClient } from "../../../storage/storageClient";
import { createPhase10QaSession, type Phase10QaSession } from "./phase10QaSession";
import { phase10QaEnabled } from "./phase10QaMode";

const Context = createContext<Phase10QaSession | null>(null);
export const usePhase10QaSession = () => useContext(Context);

export function Phase10QaProvider({ children }: PropsWithChildren) {
  const [session] = useState(() => phase10QaEnabled ? createPhase10QaSession(storageClient) : null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (session) void session.restoreClock().then(() => { if (mounted) setReady(true); }, () => { if (mounted) setError(true); });
    return () => { mounted = false; };
  }, [session]);
  if (!session) return children;
  if (error) return <AppText>Isolated QA storage could not be opened. Restart Bloom E2E to retry.</AppText>;
  if (!ready) return null;
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
