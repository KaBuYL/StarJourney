const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Window sizes for the two "forms" of the widget.
const PET_SIZE = { width: 135, height: 150 };
const MEMO_SIZE = { width: 360, height: 480 };

let mainWindow = null;
let tray = null;
let currentMode = 'pet'; // Track current window mode: 'pet' or 'memo'

// ---- Persistence -----------------------------------------------------------
function getDataPath() {
  // Store data in app-specific user data directory
  // For development: %APPDATA%/desktop-pet-memo/
  // For packaged app: %APPDATA%/DesktopPetMemo/
  let dataDir;
  
  if (app.isPackaged) {
    const projectRoot = path.dirname(__dirname);
    const projectDir = path.dirname(projectRoot);
    dataDir = path.join(projectDir, 'Star-Adventure-data');
  } else {
    // In development, use a development-specific folder
    const projectRoot = path.dirname(__dirname);
    const projectDir = path.dirname(projectRoot);
    dataDir = path.join(projectDir, 'Star-Adventure-data');
  }
  
  // Create data directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return path.join(dataDir, 'pet-memo-data.json');
}

// Migrate data from old location to new location
function migrateOldDataIfExists() {
  try {
    // Old data location (inside project)
    const projectRoot = path.dirname(__dirname);
    const oldDataDir = path.join(projectRoot, 'data');
    const oldDataFile = path.join(oldDataDir, 'pet-memo-data.json');
    
    // New data location
    const newDataFile = getDataPath();
    
    // If old data exists and new data doesn't exist, migrate it
    if (fs.existsSync(oldDataFile) && !fs.existsSync(newDataFile)) {
      console.log('Migrating data from old location to new location...');
      
      // Copy the file
      const oldData = fs.readFileSync(oldDataFile, 'utf-8');
      fs.writeFileSync(newDataFile, oldData, 'utf-8');
      
      console.log('Data migration completed successfully.');
      console.log(`Old location: ${oldDataFile}`);
      console.log(`New location: ${newDataFile}`);
    }
  } catch (err) {
    console.error('Failed to migrate old data:', err);
  }
}

function defaultData() {
  return { todos: [], history: [] };
}

function loadData() {
  try {
    const file = getDataPath();
    if (!fs.existsSync(file)) return defaultData();
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch (err) {
    console.error('Failed to load data:', err);
    return defaultData();
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save data:', err);
    return false;
  }
}

// ---- Window ----------------------------------------------------------------
function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: PET_SIZE.width,
    height: PET_SIZE.height,
    x: screenW - PET_SIZE.width - 40,
    y: 120,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true, // 隐藏任务栏图标
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ---- Tray ------------------------------------------------------------------
function createTray() {
  // 创建托盘图标
  const iconPath = path.join(__dirname, 'assets', 'favicon.ico');
  let trayIcon;
  
  // 尝试加载图标文件
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }
  
  // 如果没有图标文件，创建一个简单的图标
  if (trayIcon.isEmpty()) {
    // 使用 DataURL 创建一个简单的粉色圆形图标
    // 这是 16x16 的 PNG 粉色圆形
    const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVQ4T2NkoBAwUqifYdAY8B8I/v9lgMxAASYG6jvI/19giADEgNwFyMk+JhBkBiIzgBr0F2QJIvORjBS0F+QG6jvIbKBuI2sF3QWZgcpMdEBmoO4D1Hsg0UZkIKYz2IDMBBkYqDAwF4QYNAQGAJu5CgO6s70JAAAAAElFTkSuQmCC';
    trayIcon = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
  }
  
  tray = new Tray(trayIcon);
  tray.setToolTip('星游记');
  
  // 托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '显示窗口', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      } 
    },
    { 
      label: '隐藏窗口', 
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      } 
    },
    { type: 'separator' },
    { 
      label: '退出', 
      click: () => {
        app.quit();
      } 
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // 点击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ---- IPC handlers ----------------------------------------------------------
ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_event, data) => saveData(data));

ipcMain.on('window:setMode', (_event, mode) => {
  if (!mainWindow) return;
  
  // Update current mode
  currentMode = mode;
  
  const target = mode === 'memo' ? MEMO_SIZE : PET_SIZE;
  const bounds = mainWindow.getBounds();
  const rightEdge = bounds.x + bounds.width;
  const bottomEdge = bounds.y + bounds.height;

  let newX = rightEdge - target.width;
  let newY = bottomEdge - target.height;

  const { workArea } = screen.getDisplayMatching(bounds);
  newX = Math.max(workArea.x, Math.min(newX, workArea.x + workArea.width - target.width));
  newY = Math.max(workArea.y, Math.min(newY, workArea.y + workArea.height - target.height));

  mainWindow.setBounds({ x: Math.round(newX), y: Math.round(newY), width: target.width, height: target.height });
});

ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:close', () => app.quit());

// Window drag - use mouse movement delta to move window
let lastMousePos = null;
let dragStartBounds = null;
let totalDragDelta = { x: 0, y: 0 };

ipcMain.on('window:dragStart', (event, { mouseX, mouseY }) => {
  if (!mainWindow) return;
  lastMousePos = { x: mouseX, y: mouseY };
  dragStartBounds = mainWindow.getBounds();
  totalDragDelta = { x: 0, y: 0 };
});

ipcMain.on('window:dragMove', (event, { mouseX, mouseY }) => {
  if (!mainWindow || !lastMousePos || !dragStartBounds) return;
  
  // Calculate how much the mouse has moved since last update
  const deltaX = mouseX - lastMousePos.x;
  const deltaY = mouseY - lastMousePos.y;
  
  // Update total drag delta
  totalDragDelta.x += deltaX;
  totalDragDelta.y += deltaY;
  
  // Move window by total delta while keeping the ORIGINAL size from when drag started
  // This prevents the window from resizing during drag
  mainWindow.setBounds({
    x: dragStartBounds.x + totalDragDelta.x,
    y: dragStartBounds.y + totalDragDelta.y,
    width: dragStartBounds.width,
    height: dragStartBounds.height
  });
  
  // Update last mouse position
  lastMousePos = { x: mouseX, y: mouseY };
});

ipcMain.on('window:dragEnd', () => {
  if (!mainWindow) return;
  
  // Reset window size after drag to ensure correct size
  const target = currentMode === 'memo' ? MEMO_SIZE : PET_SIZE;
  const bounds = mainWindow.getBounds();
  
  mainWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: target.width,
    height: target.height
  });
  
  lastMousePos = null;
  dragStartBounds = null;
  totalDragDelta = { x: 0, y: 0 };
});

// ---- App lifecycle ---------------------------------------------------------
app.whenReady().then(() => {
  createTray();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 修改：关闭窗口时不退出应用，只是隐藏窗口
app.on('window-all-closed', (e) => {
  // 阻止默认行为，不退出应用
  e.preventDefault();
  // 只隐藏窗口
  if (mainWindow) {
    mainWindow.hide();
  }
});

// 真正退出时销毁托盘
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
  }
});
