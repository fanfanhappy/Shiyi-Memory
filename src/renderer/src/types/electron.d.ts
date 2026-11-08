import type { ConversationApi, MemoryApi } from "../../../shared/ipc";

export {};

declare global {
  interface Window {
    shiyi: {
      getAppVersion: () => Promise<string>;

      memory: MemoryApi;

      conversation: ConversationApi;
    };
  }
}
