import path from 'path';
import { app, BrowserWindow } from 'electron';
import serve from 'electron-serve';
import { createWindow } from './helpers/create-window';

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  serve({ directory: 'app' });
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}

async function bootstrap() {
  await app.whenReady();

  // 1. Show splash screen first (fast visual feedback)
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  splash.loadFile(path.join(__dirname, '../resources/splash.html'));

  // 2. Create main window (hidden until ready)
  const mainWindow = createWindow('main', {
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 3. Lazy DB init — heavy modules loaded AFTER splash is visible
  const { createConnection } = await import('./db/connection');
  const { applySchema } = await import('./db/schema');
  const { createStatements } = await import('./db/statements');
  const { TrashService } = await import('./db/trash');
  const { EventBus } = await import('./events/bus');
  const { registerIpcHandlers } = await import('./ipc/register');

  const dbPath = isProd
    ? path.join(app.getPath('userData'), 'pm-supporter.db')
    : path.join(app.getPath('userData'), 'pm-supporter-dev.db');

  const db = createConnection(dbPath);
  applySchema(db);
  const stmts = createStatements(db);
  const trash = new TrashService(db, stmts);
  const bus = new EventBus();

  const { GoogleAuth } = await import('./google/auth');
  const { CalendarSync } = await import('./google/calendar-sync');
  const googleAuth = new GoogleAuth(db, stmts);
  const calendarSync = new CalendarSync(db, stmts, googleAuth, bus);

  // 4. Register IPC handlers
  registerIpcHandlers({ db, stmts, trash, bus, googleAuth, calendarSync, mainWindow });

  const { registerCrossLinks } = await import('./events/cross-links');
  registerCrossLinks(db, stmts, bus);

  // Background sync on startup
  calendarSync.sync().catch((err) => console.error('[CalendarSync] Initial sync failed:', err));

  // 5. Load page (keep Nextron's URL pattern)
  if (isProd) {
    await mainWindow.loadURL('app://./home');
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`);
    mainWindow.webContents.openDevTools();
  }

  // 6. When page is rendered, destroy splash and show main window
  mainWindow.once('ready-to-show', () => {
    splash.destroy();
    mainWindow.show();
  });

  // 7. Clean up DB on window close
  mainWindow.on('closed', () => {
    db.close();
  });
}

bootstrap();

app.on('window-all-closed', () => {
  app.quit();
});
