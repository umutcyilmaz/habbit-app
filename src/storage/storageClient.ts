import AsyncStorage from "@react-native-async-storage/async-storage";

export type StorageKey = string;

export interface StorageClient {
  getItem<TValue>(key: StorageKey): Promise<TValue | null>;
  setItem<TValue>(key: StorageKey, value: TValue): Promise<void>;
  removeItem(key: StorageKey): Promise<void>;
  clearUserData(): Promise<void>;
}

export const storageClient: StorageClient = {
  async getItem<TValue>(key: StorageKey) {
    const rawValue = await AsyncStorage.getItem(key);

    if (rawValue === null) {
      return null;
    }

    return JSON.parse(rawValue) as TValue;
  },
  async setItem<TValue>(key: StorageKey, value: TValue) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: StorageKey) {
    await AsyncStorage.removeItem(key);
  },
  async clearUserData() {
    await AsyncStorage.clear();
  }
};
