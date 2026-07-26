export type StorageKey = string;

export interface StorageClient {
  getItem(key: StorageKey): Promise<string | null>;
  setItem(key: StorageKey, value: string): Promise<void>;
  removeItem(key: StorageKey): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export type WebStorage = {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
};

export type WebStorageWindow = {
  readonly localStorage: WebStorage;
};

export type WebStorageEnvironment =
  | {
      status: "available";
      storage: WebStorage;
    }
  | {
      status: "non-browser";
    }
  | {
      status: "unavailable";
    };

export type WebStorageClientOptions = {
  resolveEnvironment?: () => WebStorageEnvironment;
  nonBrowserFallback?: StorageClient;
};

export const STORAGE_UNAVAILABLE_ERROR_CODE = "storage-unavailable" as const;

export class StorageUnavailableError extends Error {
  readonly code = STORAGE_UNAVAILABLE_ERROR_CODE;
  readonly adapter = "web-local-storage" as const;

  constructor() {
    super("Bloom web storage is unavailable.");
    this.name = "StorageUnavailableError";
  }
}

export function isStorageUnavailableError(
  error: unknown
): error is StorageUnavailableError {
  return (
    error instanceof StorageUnavailableError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === STORAGE_UNAVAILABLE_ERROR_CODE)
  );
}

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
    },
    async getAllKeys() {
      return Array.from(values.keys());
    }
  };
}

export function createWebStorageClient(
  options: WebStorageClientOptions = {}
): StorageClient {
  const resolveEnvironment =
    options.resolveEnvironment ?? resolveWebStorageEnvironment;
  const nonBrowserFallback =
    options.nonBrowserFallback ?? createMemoryStorageClient();

  const resolveStorage = (): WebStorage | null => {
    let environment: WebStorageEnvironment;

    try {
      environment = resolveEnvironment();
    } catch {
      throw new StorageUnavailableError();
    }

    if (environment.status === "unavailable") {
      throw new StorageUnavailableError();
    }

    return environment.status === "available" ? environment.storage : null;
  };

  return {
    async getItem(key) {
      const webStorage = resolveStorage();

      if (webStorage === null) {
        return nonBrowserFallback.getItem(key);
      }

      return runWebStorageOperation(() => webStorage.getItem(key));
    },
    async setItem(key, value) {
      const webStorage = resolveStorage();

      if (webStorage === null) {
        await nonBrowserFallback.setItem(key, value);
        return;
      }

      runWebStorageOperation(() => webStorage.setItem(key, value));
    },
    async removeItem(key) {
      const webStorage = resolveStorage();

      if (webStorage === null) {
        await nonBrowserFallback.removeItem(key);
        return;
      }

      runWebStorageOperation(() => webStorage.removeItem(key));
    },
    async getAllKeys() {
      const webStorage = resolveStorage();

      if (webStorage === null) {
        return nonBrowserFallback.getAllKeys();
      }

      return runWebStorageOperation(() => {
        const keys: string[] = [];

        for (let index = 0; index < webStorage.length; index += 1) {
          const key = webStorage.key(index);

          if (key !== null) {
            keys.push(key);
          }
        }

        return keys;
      });
    }
  };
}

export function resolveWebStorageEnvironment(
  browserWindow: WebStorageWindow | undefined = getBrowserWindow()
): WebStorageEnvironment {
  if (browserWindow === undefined) {
    return { status: "non-browser" };
  }

  try {
    const storage = browserWindow.localStorage;

    return storage === undefined || storage === null
      ? { status: "unavailable" }
      : { status: "available", storage };
  } catch {
    return { status: "unavailable" };
  }
}

function getBrowserWindow(): WebStorageWindow | undefined {
  return typeof window === "undefined" ? undefined : window;
}

function runWebStorageOperation<TResult>(operation: () => TResult): TResult {
  try {
    return operation();
  } catch {
    throw new StorageUnavailableError();
  }
}
