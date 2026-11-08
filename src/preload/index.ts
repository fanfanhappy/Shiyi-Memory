import { contextBridge, ipcRenderer } from "electron";

import {
  MEMORY_IPC,
  type MemoryApi
} from "../shared/ipc";

const memoryApi: MemoryApi = {
  list: (query) => ipcRenderer.invoke(MEMORY_IPC.list, query),

  get: (id) => ipcRenderer.invoke(MEMORY_IPC.get, id),

  create: (input) => ipcRenderer.invoke(MEMORY_IPC.create, input),

  update: (input) => ipcRenderer.invoke(MEMORY_IPC.update, input),

  archive: (input) => ipcRenderer.invoke(MEMORY_IPC.archive, input),

  restore: (input) => ipcRenderer.invoke(MEMORY_IPC.restore, input),

  remove: (input) => ipcRenderer.invoke(MEMORY_IPC.remove, input),

  versions: (id, query) =>
    ipcRenderer.invoke(MEMORY_IPC.versions, id, query),

  audit: (id, query) => ipcRenderer.invoke(MEMORY_IPC.audit, id, query)
};

const shiyiAPI = {
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke("shiyi:get-app-version");
  },

  memory: memoryApi
};

contextBridge.exposeInMainWorld("shiyi", shiyiAPI);
