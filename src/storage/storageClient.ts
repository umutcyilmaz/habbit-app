import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  createWebStorageClient,
  type StorageClient
} from "./storageAdapters";

export * from "./storageAdapters";

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
    },
    getAllKeys() {
      return AsyncStorage.getAllKeys();
    }
  };
}

export const storageClient: StorageClient =
  Platform.OS === "web"
    ? createWebStorageClient()
    : createNativeStorageClient();
