import { contextBridge, ipcRenderer } from "electron";

const shiyiAPI = {
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke("shiyi:get-app-version");
  }
};

contextBridge.exposeInMainWorld("shiyi", shiyiAPI);
