import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import {
  initializeDatabase,
  closeDatabase,
  getDatabasePath
} from "./database/connection";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: "拾忆 Shiyi",
    backgroundColor: "#F5F5F7",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(
      join(__dirname, "../renderer/index.html")
    );
  }
}

app.whenReady().then(() => {
  // 初始化本地记忆数据库
  const databaseDirectory = app.isPackaged
    ? join(app.getPath("userData"), "data")
    : join(app.getAppPath(), "data-dev");

  initializeDatabase(databaseDirectory);

  console.info("[Shiyi] Database path:", getDatabasePath());

  console.info(
    `[Shiyi] Environment: ${app.isPackaged ? "production" : "development"}`
  );

  ipcMain.handle("shiyi:get-app-version", () => app.getVersion());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  closeDatabase();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
