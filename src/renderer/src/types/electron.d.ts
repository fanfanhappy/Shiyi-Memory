import type { MemoryApi } from "../../../shared/ipc";

export {};

declare global {
  interface Window {
    shiyi: {
      getAppVersion: () => Promise<string>;
      memory: MemoryApi;
    };
  }
}
