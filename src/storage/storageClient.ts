export type StorageKey = string;

export interface StorageClient {
  getItem<TValue>(key: StorageKey): Promise<TValue | null>;
  setItem<TValue>(key: StorageKey, value: TValue): Promise<void>;
  removeItem(key: StorageKey): Promise<void>;
  clearUserData(): Promise<void>;
}

export const storageClient: StorageClient = {
  async getItem() {
    return null;
  },
  async setItem() {
    return undefined;
  },
  async removeItem() {
    return undefined;
  },
  async clearUserData() {
    return undefined;
  }
};
