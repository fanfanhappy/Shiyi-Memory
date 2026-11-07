export {};

declare global {
  interface Window {
    shiyi: {
      getAppVersion: () => Promise<string>;
    };
  }
}
