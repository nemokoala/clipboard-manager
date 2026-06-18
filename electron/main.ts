import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import path from 'node:path'
import {
  initDb,
  getAllItems,
  searchItems,
  deleteItem,
  deleteAll,
  getTotalSize,
} from './db'
import {
  startClipboardWatcher,
  stopClipboardWatcher,
  writeToClipboard,
} from './clipboard'
import { createTray, destroyTray, broadcastCleared } from './tray'
import { getShortcut, setStoredShortcut, DEFAULT_SHORTCUT } from './settings'

// dist-electron/  ← compiled main + preload live here (CommonJS, so __dirname
// is available natively).
// dist/           ← compiled renderer
// The project root is one level up from dist-electron.
process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

// 개발 모드 여부(Vite 개발 서버 URL 이 있으면 dev)
const IS_DEV = !!VITE_DEV_SERVER_URL

let win: BrowserWindow | null = null
let settingsWin: BrowserWindow | null = null

/** The accelerator currently registered with the OS (so we can replace it). */
let activeShortcut = ''

function createWindow(): void {
  win = new BrowserWindow({
    width: 480,
    height: 600,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    // Transparent on both platforms so the CSS `rounded-2xl` corners are the
    // actual window shape (a native acrylic layer is rectangular and can't
    // follow the rounded corners, which made the radius look off on Windows).
    transparent: true,
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Show the overlay once on first launch so it's not a mystery that the app
  // is running. (`show: false` avoids a white flash before the UI is painted.)
  win.once('ready-to-show', () => {
    showWindow()
  })

  // 포커스를 잃으면 오버레이를 자동으로 숨긴다.
  win.on('blur', () => {
    // 개발 모드에서는 에디터/DevTools 로 포커스가 이동해도 창을 숨기지 않는다.
    if (IS_DEV) return
    if (win && !win.webContents.isDevToolsOpened()) {
      win.hide()
    }
  })
}

/** Toggle the overlay, positioning it near the cursor / screen centre. */
function toggleWindow(): void {
  if (!win) return
  if (win.isVisible()) {
    win.hide()
    return
  }
  positionWindow()
  win.show()
  win.focus()
}

function showWindow(): void {
  if (!win) return
  positionWindow()
  win.show()
  win.focus()
}

/** Centre the window horizontally on the display under the cursor. */
function positionWindow(): void {
  if (!win) return
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width, height, x, y } = display.workArea
  const [winW, winH] = win.getSize()
  win.setPosition(
    Math.round(x + (width - winW) / 2),
    Math.round(y + (height - winH) / 3),
  )
}

/**
 * Register `accelerator` as the global toggle shortcut, replacing whatever was
 * registered before. Returns false if the OS rejects it (e.g. already taken by
 * another app), leaving no shortcut registered for the caller to handle.
 */
function applyShortcut(accelerator: string): boolean {
  if (activeShortcut) {
    globalShortcut.unregister(activeShortcut)
    activeShortcut = ''
  }
  try {
    const ok = globalShortcut.register(accelerator, toggleWindow)
    if (ok) {
      activeShortcut = accelerator
      return true
    }
  } catch {
    /* fall through to false */
  }
  return false
}

/** Open (or focus) the settings window. */
function openSettingsWindow(): void {
  if (settingsWin) {
    settingsWin.show()
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 460,
    height: 380,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: '설정',
    backgroundColor: '#171717',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Drop the default File/Edit/View… menu bar — this is a simple settings dialog.
  settingsWin.removeMenu()

  // The renderer decides what to render based on the URL hash.
  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}#settings`)
  } else {
    settingsWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'settings' })
  }

  settingsWin.on('closed', () => {
    settingsWin = null
    // Safety net: if the window was closed mid-recording, the shortcut may be
    // unregistered — restore the saved one.
    if (!activeShortcut) applyShortcut(getShortcut())
  })
}

function registerIpc(): void {
  ipcMain.handle('db:getAll', () => getAllItems())
  ipcMain.handle('db:search', (_e, query: string) => searchItems(query))
  ipcMain.handle('db:delete', (_e, id: number) => deleteItem(id))
  ipcMain.handle('db:deleteAll', () => deleteAll())
  ipcMain.handle('db:totalSize', () => getTotalSize())
  ipcMain.handle('clipboard:copy', (_e, content: string) => writeToClipboard(content))
  ipcMain.handle('window:hide', () => win?.hide())

  // --- Settings ---
  ipcMain.handle('settings:get', () => ({
    shortcut: getShortcut(),
    defaultShortcut: DEFAULT_SHORTCUT,
  }))

  ipcMain.handle('settings:setShortcut', (_e, accelerator: string) => {
    const ok = applyShortcut(accelerator)
    if (ok) {
      setStoredShortcut(accelerator)
      return { ok: true }
    }
    // Registration failed — restore the previously saved shortcut.
    applyShortcut(getShortcut())
    return { ok: false, error: '이 단축키를 등록할 수 없습니다 (다른 앱이 사용 중일 수 있어요).' }
  })

  ipcMain.handle('settings:open', () => openSettingsWindow())
  ipcMain.handle('settings:closeSelf', (e) =>
    BrowserWindow.fromWebContents(e.sender)?.close(),
  )

  // While the user is recording a new combo, suspend the global shortcut so it
  // (a) doesn't trigger the overlay and (b) reaches the renderer to be captured.
  ipcMain.handle('settings:setRecording', (_e, recording: boolean) => {
    if (recording) {
      globalShortcut.unregisterAll()
      activeShortcut = ''
    } else {
      applyShortcut(getShortcut())
    }
  })
}

app.whenReady().then(() => {
  initDb()
  registerIpc()
  createWindow()

  createTray({
    onOpen: showWindow,
    onSettings: openSettingsWindow,
    onCleared: () => broadcastCleared(),
  })

  // Live updates: push every captured item to the renderer.
  startClipboardWatcher((item) => {
    win?.webContents.send('clipboard:new', item)
  })

  // Register the user's saved shortcut (defaults to Ctrl/Cmd+Shift+V).
  const registered = applyShortcut(getShortcut())
  if (!registered) {
    console.warn(`[main] failed to register global shortcut "${getShortcut()}"`)
  }

  // macOS: hide the dock icon — this is a tray/overlay utility.
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
})

// Keep running in the tray even when all windows are closed.
app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopClipboardWatcher()
  destroyTray()
})
