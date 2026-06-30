export type StorageKey = string;

export interface StorageClient {
  getItem<TValue>(key: StorageKey): Promise<TValue | null>;
  setItem<TValue>(key: StorageKey, value: TValue): Promise<void>;
  removeItem(key: StorageKey): Promise<void>;
  clearUserData(): Promise<void>;
}

const memoryStorage = new Map<string, string>();

export const storageClient: StorageClient = {
  async getItem<TValue>(key: StorageKey) {
    const rawValue = getRawValue(key);

    if (rawValue === null) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as TValue;
    } catch {
      return null;
    }
  },
  async setItem<TValue>(key: StorageKey, value: TValue) {
    const rawValue = JSON.stringify(value);

    if (canUseLocalStorage()) {
      localStorage.setItem(key, rawValue);
      return;
    }

    memoryStorage.set(key, rawValue);
  },
  async removeItem(key: StorageKey) {
    if (canUseLocalStorage()) {
      localStorage.removeItem(key);
      return;
    }

    memoryStorage.delete(key);
  },
  async clearUserData() {
    if (canUseLocalStorage()) {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("bloom."))
        .forEach((key) => localStorage.removeItem(key));
      return;
    }

    memoryStorage.clear();
  }
};

function getRawValue(key: StorageKey) {
  if (canUseLocalStorage()) {
    return localStorage.getItem(key);
  }

  return memoryStorage.get(key) ?? null;
}

function canUseLocalStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}
