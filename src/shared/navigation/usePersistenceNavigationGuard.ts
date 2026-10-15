import { useCallback, useEffect, useRef } from "react";
import { usePreventRemove } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { BackHandler, Platform } from "react-native";

export function usePersistenceNavigationGuard(blocked: boolean, { gesturesDisabled = false, handleHardwareBack = true }:
  { gesturesDisabled?: boolean; handleHardwareBack?: boolean } = {}) {
  const navigation = useNavigation();
  const allowNextRemovalRef = useRef(false);
  const allowanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !blocked && !gesturesDisabled });
  }, [blocked, gesturesDisabled, navigation]);

  usePreventRemove(blocked, ({ data }) => {
    if (!allowNextRemovalRef.current) {
      return;
    }

    allowNextRemovalRef.current = false;

    if (allowanceTimeoutRef.current !== null) {
      clearTimeout(allowanceTimeoutRef.current);
      allowanceTimeoutRef.current = null;
    }

    navigation.dispatch(data.action);
  });

  useEffect(() => {
    if (blocked) {
      return undefined;
    }

    allowNextRemovalRef.current = false;

    if (allowanceTimeoutRef.current !== null) {
      clearTimeout(allowanceTimeoutRef.current);
      allowanceTimeoutRef.current = null;
    }

    return undefined;
  }, [blocked]);

  useEffect(
    () => () => {
      if (allowanceTimeoutRef.current !== null) {
        clearTimeout(allowanceTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!blocked || !handleHardwareBack || Platform.OS === "web") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );

    return () => subscription.remove();
  }, [blocked, handleHardwareBack]);

  return useCallback(() => {
    allowNextRemovalRef.current = true;

    if (allowanceTimeoutRef.current !== null) {
      clearTimeout(allowanceTimeoutRef.current);
    }

    allowanceTimeoutRef.current = setTimeout(() => {
      allowNextRemovalRef.current = false;
      allowanceTimeoutRef.current = null;
    }, 1000);
  }, []);
}
