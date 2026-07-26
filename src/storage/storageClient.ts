import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type StorageKey = string;

export interface StorageClient {
  getItem(key: StorageKey): Promise<string | null>;
  setItem(key: StorageKey, value: string): Promise<void>;
  removeItem(key: StorageKey): Promise<void>;
}

type WebStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function createMemoryStorageClient(): StorageClient {
  const values = new Map<string, string>();

  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    }
  };
}

export function createWebStorageClient(
  unavailableEnvironmentFallback = createMemoryStorageClient()
): StorageClient {
  return {
    async getItem(key) {
      const webStorage = getWebStorage();
      return webStorage
        ? webStorage.getItem(key)
        : unavailableEnvironmentFallback.getItem(key);
    },
    async setItem(key, value) {
      const webStorage = getWebStorage();

      if (webStorage) {
        webStorage.setItem(key, value);
        return;
      }

      await unavailableEnvironmentFallback.setItem(key, value);
    },
    async removeItem(key) {
      const webStorage = getWebStorage();

      if (webStorage) {
        webStorage.removeItem(key);
        return;
      }

      await unavailableEnvironmentFallback.removeItem(key);
    }
  };
}

export function createNativeStorageClient(): StorageClient {
  return {
    getItem(key) {
      return AsyncStorage.getItem(key);
    },
    setItem(key, value) {
      return AsyncStorage.setItem(key, value);
    },
    removeItem(key) {
      return AsyncStorage.removeItem(key);
    }
  };
}

export const storageClient: StorageClient =
  Platform.OS === "web"
    ? createWebStorageClient()
    : createNativeStorageClient();

function getWebStorage(): WebStorage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
}
