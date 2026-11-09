import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function initDatabase(): string {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const targetDbPath = path.join(userDataPath, 'distributor.db');

  if (!fs.existsSync(targetDbPath)) {
    console.log('[DB] Target database not found in userData. Copying from template...');
    const possibleTemplates = [
      path.join(process.resourcesPath, 'prisma', 'distributor.db'),
      path.join(app.getAppPath(), 'prisma', 'distributor.db'),
      path.join(__dirname, '../../prisma/distributor.db'),
      path.join(process.cwd(), 'prisma', 'distributor.db')
    ];

    let copied = false;
    for (const templatePath of possibleTemplates) {
      if (fs.existsSync(templatePath)) {
        try {
          fs.copyFileSync(templatePath, targetDbPath);
          console.log(`[DB] Successfully seeded database from ${templatePath}`);
          copied = true;
          break;
        } catch (err) {
          console.error(`[DB] Failed to copy from ${templatePath}:`, err);
        }
      }
    }

    if (!copied) {
      console.warn('[DB] No template found. Prisma will initialize schema on demand.');
    }
  } else {
    console.log(`[DB] Using existing database at ${targetDbPath}`);
  }

  const normalizedPath = targetDbPath.replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${normalizedPath}`;
  process.env.PORT = '4812';
  process.env.HOST = '127.0.0.1';
  console.log(`[DB] Configured DATABASE_URL = ${process.env.DATABASE_URL}`);
  return targetDbPath;
}

function startBackendServer() {
  try {
    initDatabase();
    if (!isDev) {
      console.log('[Electron Main] Loading bundled backend server...');
      require('./server.bundle.js');
      console.log('[Electron Main] Bundled backend server started.');
    }
  } catch (err) {
    console.error('[Electron Main] Failed to start backend server:', err);
  }
}

async function waitForServer(port: number = 4812, maxWaitMs: number = 15000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) {
        console.log('[Electron Main] Backend health check passed.');
        return true;
      }
    } catch {
      // Waiting for server to listen
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.warn('[Electron Main] Backend health check timed out. Proceeding to open window.');
  return false;
}

function getAppIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../../public/samantha-logo.png'),
    path.join(__dirname, '../../dist/samantha-logo.png'),
    path.join(process.resourcesPath, 'build/icon.png')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return undefined;
}

function createWindow() {
  const iconPath = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#F1F3F6',
    title: 'Samantha Distributor Management',
    icon: iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devUrl = 'http://localhost:5173';
  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    startBackendServer();
    await waitForServer(4812, 12000);
  } else {
    initDatabase();
  }

  createWindow();

  // IPC Handlers for native printing
  ipcMain.handle('print-page', async () => {
    if (!mainWindow) return;
    mainWindow.webContents.print({ silent: false, printBackground: true });
  });

  ipcMain.handle('print-to-pdf', async () => {
    if (!mainWindow) return null;
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    });
    return pdfData;
  });

  ipcMain.handle('open-external', async (_event, url: string) => {
    if (url) {
      await shell.openExternal(url);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
