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
import {
  useBloomLocalState,
  type BloomLocalDataDeletionRequest
} from "./BloomLocalStateProvider";
import {
  isBloomLocalDataDeletionPendingError,
  observeBloomLocalDataDeletionSettlement
} from "./bloomLocalDataDeletionWatchdog";
import { useResetDemoAppState } from "./DemoAppStateProvider";

export type LocalDataDeletionStatus = "idle" | "deleting" | "success" | "error";

type LocalDataLifecycleContextValue = {
  deletionStatus: LocalDataDeletionStatus;
  deletionError: string | null;
  deleteAllLocalData: () => Promise<void>;
  retryBloomLocalDataResetNavigation: () => void;
  clearDeletionStatus: () => void;
};

const BLOOM_LOCAL_DATA_RESET_NAVIGATION_TIMEOUT_MS = 10_000;

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
  const [navigationRetrySequence, setNavigationRetrySequence] = useState(0);
  const isMountedRef = useRef(false);
  const deletionStatusRef = useRef<LocalDataDeletionStatus>("idle");
  const deletionPromiseRef = useRef<Promise<void> | null>(null);
  const observedDeletionSettlementRef = useRef<Promise<void> | null>(null);
  const completedDeletionSettlementRef = useRef<Promise<void> | null>(null);
  const hasNavigatedAfterDeletionRef = useRef(false);
  deletionStatusRef.current = deletionStatus;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (
      deletionStatus !== "success" ||
      pathname === routes.onboarding ||
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
          "Your local data was deleted, but Bloom couldn’t open onboarding. Try again."
        );
      }

      if (__DEV__) {
        console.warn("Bloom could not open onboarding after local data deletion.");
      }
    }
  }, [deletionStatus, navigationRetrySequence, pathname, router]);

  useEffect(() => {
    if (
      deletionStatus !== "success" ||
      pathname === routes.onboarding ||
      deletionError !== null
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      hasNavigatedAfterDeletionRef.current = false;
      setDeletionError(
        "Your local data was deleted, but Bloom couldn’t open onboarding. Try again."
      );
    }, BLOOM_LOCAL_DATA_RESET_NAVIGATION_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [deletionError, deletionStatus, pathname]);

  useEffect(() => {
    if (
      deletionStatus === "success" &&
      pathname === routes.onboarding
    ) {
      finishBloomLocalDataReset();
      hasNavigatedAfterDeletionRef.current = false;
      setDeletionError(null);
      setDeletionStatus("idle");
    }
  }, [deletionStatus, finishBloomLocalDataReset, pathname]);

  const retryBloomLocalDataResetNavigation = useCallback(() => {
    if (
      deletionStatus !== "success" ||
      pathname === routes.onboarding
    ) {
      return;
    }

    hasNavigatedAfterDeletionRef.current = false;
    setDeletionError(null);
    setNavigationRetrySequence((currentSequence) => currentSequence + 1);
  }, [deletionStatus, pathname]);

  const handleDeletionSuccess = useCallback(
    (settlement: Promise<void>) => {
      if (
        !isMountedRef.current ||
        completedDeletionSettlementRef.current === settlement
      ) {
        return;
      }

      completedDeletionSettlementRef.current = settlement;
      resetDemoAppState();
      setDeletionError(null);
      setDeletionStatus("success");
    },
    [resetDemoAppState]
  );

  const handleDeletionFailure = useCallback((settlement: Promise<void>) => {
    if (
      !isMountedRef.current ||
      completedDeletionSettlementRef.current === settlement
    ) {
      return;
    }

    completedDeletionSettlementRef.current = settlement;
    setDeletionStatus("error");
    setDeletionError(
      "Bloom couldn’t delete all local data. Your existing data may still be present."
    );
  }, []);

  const observeDeletionSettlement = useCallback(
    (request: BloomLocalDataDeletionRequest) => {
      if (observedDeletionSettlementRef.current === request.settlement) {
        return;
      }

      observedDeletionSettlementRef.current = request.settlement;
      observeBloomLocalDataDeletionSettlement(
        request.settlement,
        () => handleDeletionSuccess(request.settlement),
        () => handleDeletionFailure(request.settlement)
      );
    },
    [handleDeletionFailure, handleDeletionSuccess]
  );

  const deleteAllLocalData = useCallback((): Promise<void> => {
    if (deletionPromiseRef.current !== null) {
      return deletionPromiseRef.current;
    }

    hasNavigatedAfterDeletionRef.current = false;
    setDeletionStatus("deleting");
    setDeletionError(null);

    const request = deleteAllBloomLocalData();
    observeDeletionSettlement(request);

    const deletionPromise = request.acknowledgement
      .then(() => {
        handleDeletionSuccess(request.settlement);
      })
      .catch((error: unknown) => {
        if (isMountedRef.current) {
          setDeletionStatus("error");
          setDeletionError(
            isBloomLocalDataDeletionPendingError(error)
              ? "Bloom is still confirming local data deletion. You can leave this screen safely and try again later."
              : "Bloom couldn’t delete all local data. Your existing data may still be present."
          );
        }

        throw error;
      })
      .finally(() => {
        if (deletionPromiseRef.current === deletionPromise) {
          deletionPromiseRef.current = null;
        }
      });

    deletionPromiseRef.current = deletionPromise;
    return deletionPromise;
  }, [
    deleteAllBloomLocalData,
    handleDeletionSuccess,
    observeDeletionSettlement
  ]);

  const clearDeletionStatus = useCallback(() => {
    if (
      deletionPromiseRef.current !== null ||
      deletionStatusRef.current === "success"
    ) {
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
      retryBloomLocalDataResetNavigation,
      clearDeletionStatus
    }),
    [
      clearDeletionStatus,
      deleteAllLocalData,
      deletionError,
      deletionStatus,
      retryBloomLocalDataResetNavigation
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
