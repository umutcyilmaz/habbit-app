import { usePathname, useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";

import { routes } from "../../constants/navigation";
import { useBloomLocalState } from "./BloomLocalStateProvider";
import { useResetDemoAppState } from "./DemoAppStateProvider";

export type LocalDataDeletionStatus = "idle" | "deleting" | "success" | "error";

type LocalDataLifecycleContextValue = {
  deletionStatus: LocalDataDeletionStatus;
  deletionError: string | null;
  deleteAllLocalData: () => Promise<void>;
  clearDeletionStatus: () => void;
};

const LocalDataLifecycleContext =
  createContext<LocalDataLifecycleContextValue | undefined>(undefined);

export function LocalDataLifecycleProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { deleteAllBloomLocalData, finishBloomLocalDataReset } =
    useBloomLocalState();
  const resetDemoAppState = useResetDemoAppState();
  const [deletionStatus, setDeletionStatus] =
    useState<LocalDataDeletionStatus>("idle");
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const deletionPromiseRef = useRef<Promise<void> | null>(null);
  const hasNavigatedAfterDeletionRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (
      deletionStatus !== "success" ||
      hasNavigatedAfterDeletionRef.current
    ) {
      return;
    }

    hasNavigatedAfterDeletionRef.current = true;
    try {
      router.replace(routes.onboarding);
    } catch {
      if (isMountedRef.current) {
        setDeletionError(
          "Your local data was deleted, but Bloom couldn’t open onboarding."
        );
      }

      if (__DEV__) {
        console.warn("Bloom could not open onboarding after local data deletion.");
      }
    }
  }, [deletionStatus, router]);

  useEffect(() => {
    if (
      deletionStatus === "success" &&
      pathname === routes.onboarding
    ) {
      finishBloomLocalDataReset();
    }
  }, [deletionStatus, finishBloomLocalDataReset, pathname]);

  const deleteAllLocalData = useCallback((): Promise<void> => {
    if (deletionPromiseRef.current !== null) {
      return deletionPromiseRef.current;
    }

    hasNavigatedAfterDeletionRef.current = false;
    setDeletionStatus("deleting");
    setDeletionError(null);

    const deletionPromise = deleteAllBloomLocalData()
      .then(() => {
        if (!isMountedRef.current) {
          return;
        }

        resetDemoAppState();
        setDeletionStatus("success");
      })
      .catch(() => {
        if (isMountedRef.current) {
          setDeletionStatus("error");
          setDeletionError(
            "Bloom couldn’t delete all local data. Your existing data may still be present."
          );
        }

        throw new Error("Bloom local data deletion failed.");
      })
      .finally(() => {
        if (deletionPromiseRef.current === deletionPromise) {
          deletionPromiseRef.current = null;
        }
      });

    deletionPromiseRef.current = deletionPromise;
    return deletionPromise;
  }, [deleteAllBloomLocalData, resetDemoAppState]);

  const clearDeletionStatus = useCallback(() => {
    if (deletionPromiseRef.current !== null) {
      return;
    }

    setDeletionStatus("idle");
    setDeletionError(null);
  }, []);

  const value = useMemo(
    () => ({
      deletionStatus,
      deletionError,
      deleteAllLocalData,
      clearDeletionStatus
    }),
    [
      clearDeletionStatus,
      deleteAllLocalData,
      deletionError,
      deletionStatus
    ]
  );

  return (
    <LocalDataLifecycleContext.Provider value={value}>
      {children}
    </LocalDataLifecycleContext.Provider>
  );
}

export function useLocalDataLifecycle() {
  const context = useContext(LocalDataLifecycleContext);

  if (context === undefined) {
    throw new Error(
      "useLocalDataLifecycle must be used inside LocalDataLifecycleProvider."
    );
  }

  return context;
}
