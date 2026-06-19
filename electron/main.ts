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
import {
  DEFAULT_HIDE_ON_BLUR,
  DEFAULT_QUICK_COPY_MODIFIER,
  DEFAULT_SHORTCUT,
  MAX_MAIN_WINDOW_HEIGHT,
  MAX_MAIN_WINDOW_WIDTH,
  MIN_MAIN_WINDOW_HEIGHT,
  MIN_MAIN_WINDOW_WIDTH,
  getHideOnBlur,
  getMainWindowSize,
  getQuickCopyModifier,
  getShortcut,
  setHideOnBlur,
  setMainWindowSize,
  setQuickCopyModifier,
  setStoredShortcut,
  type QuickCopyModifier,
} from './settings'

// dist-electron/  ← 컴파일된 main + preload (CommonJS, __dirname 사용 가능)
// dist/           ← 컴파일된 렌더러
// 프로젝트 루트는 dist-electron 의 한 단계 위.
process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

// 개발 모드 여부(Vite 개발 서버 URL 이 있으면 dev)
const IS_DEV = !!VITE_DEV_SERVER_URL

let win: BrowserWindow | null = null
let settingsWin: BrowserWindow | null = null
let toastWin: BrowserWindow | null = null
let toastReady = false
let pendingToastMessage: string | null = null
let toastHideTimer: ReturnType<typeof setTimeout> | null = null

/** OS에 현재 등록된 accelerator (교체 시 참조). */
let activeShortcut = ''
const TOAST_WIDTH = 320
const TOAST_HEIGHT = 56
const TOAST_DURATION_MS = 1400

function createWindow(): void {
  const { width, height } = getMainWindowSize()

  win = new BrowserWindow({
    width,
    height,
    frame: false,
    resizable: true,
    minWidth: MIN_MAIN_WINDOW_WIDTH,
    maxWidth: MAX_MAIN_WINDOW_WIDTH,
    minHeight: MIN_MAIN_WINDOW_HEIGHT,
    maxHeight: MAX_MAIN_WINDOW_HEIGHT,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    // CSS 패널 하나만 실제 창 형태를 만들게 한다.
    // macOS vibrancy를 transparent 창과 같이 쓰면 네이티브 material edge와
    // CSS rounded edge가 겹쳐 보여 모서리가 두 겹처럼 보일 수 있다.
    transparent: true,
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

  // 첫 실행 시 오버레이를 한 번 표시해 앱이 실행 중임을 알린다.
  // (`show: false`는 UI 페인트 전 흰 화면 깜빡임을 방지한다.)
  win.once('ready-to-show', () => {
    showWindow()
  })

  // 포커스를 잃으면 오버레이를 자동으로 숨긴다.
  win.on('blur', () => {
    // 개발 모드에서는 에디터/DevTools 로 포커스가 이동해도 창을 숨기지 않는다.
    if (IS_DEV) return
    if (!getHideOnBlur()) return
    if (win && !win.webContents.isDevToolsOpened()) {
      win.hide()
    }
  })

  win.on('resized', () => {
    if (!win) return
    const [width, height] = win.getSize()
    setMainWindowSize(width, height)
  })
}

/** 오버레이를 토글하고 커서/화면 중앙 근처에 배치한다. */
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

function createToastWindow(): void {
  toastWin = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  toastWin.setIgnoreMouseEvents(true)

  toastWin.webContents.on('did-finish-load', () => {
    toastReady = true
    if (pendingToastMessage) {
      const message = pendingToastMessage
      pendingToastMessage = null
      showToast(message)
    }
  })

  toastWin.on('closed', () => {
    toastWin = null
    toastReady = false
  })

  if (VITE_DEV_SERVER_URL) {
    toastWin.loadURL(`${VITE_DEV_SERVER_URL}#toast`)
  } else {
    toastWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'toast' })
  }
}

function showToast(message: string): void {
  if (!toastWin) {
    pendingToastMessage = message
    createToastWindow()
    return
  }

  if (!toastReady) {
    pendingToastMessage = message
    return
  }

  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width, height, x, y } = display.workArea

  toastWin.setPosition(
    Math.round(x + (width - TOAST_WIDTH) / 2),
    Math.round(y + height - TOAST_HEIGHT - 32),
  )
  toastWin.webContents.send('toast:show', message)
  toastWin.showInactive()
  toastWin.moveTop()

  if (toastHideTimer) clearTimeout(toastHideTimer)
  toastHideTimer = setTimeout(() => {
    toastWin?.hide()
    toastHideTimer = null
  }, TOAST_DURATION_MS)
}

/** 커서 아래 디스플레이 기준으로 창을 가로 중앙에 배치한다. */
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
 * `accelerator`를 전역 토글 단축키로 등록하고 이전 등록분을 교체한다.
 * OS가 거부하면 false (다른 앱이 사용 중 등) — 호출자가 처리해야 한다.
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
    /* false 반환 */
  }
  return false
}

/** 설정 창을 연다(또는 포커스한다). */
function openSettingsWindow(): void {
  if (settingsWin) {
    settingsWin.show()
    settingsWin.moveTop()
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    parent: win ?? undefined,
    modal: false,
    width: 460,
    height: 660,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    title: '설정',
    backgroundColor: '#171717',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 기본 File/Edit/View… 메뉴바 제거 — 단순 설정 대화상자.
  settingsWin.removeMenu()

  // 렌더러가 URL 해시에 따라 렌더링 내용을 결정한다.
  if (VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(`${VITE_DEV_SERVER_URL}#settings`)
  } else {
    settingsWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'settings' })
  }

  settingsWin.on('closed', () => {
    settingsWin = null
    // 안전장치: 녹화 중 창이 닫히면 단축키가 해제됐을 수 있음 — 저장된 것을 복원.
    if (!activeShortcut) applyShortcut(getShortcut())
  })
}

function registerIpc(): void {
  ipcMain.handle('db:getAll', () => getAllItems())
  ipcMain.handle('db:search', (_e, query: string) => searchItems(query))
  ipcMain.handle('db:delete', (_e, id: number) => deleteItem(id))
  ipcMain.handle('db:deleteAll', () => deleteAll())
  ipcMain.handle('db:totalSize', () => getTotalSize())
  ipcMain.handle('clipboard:copy', (_e, content: string) => {
    writeToClipboard(content)
    showToast('복사되었습니다.')
  })
  ipcMain.handle('window:hide', () => win?.hide())

  // --- 설정 ---
  ipcMain.handle('settings:get', () => ({
    shortcut: getShortcut(),
    defaultShortcut: DEFAULT_SHORTCUT,
    quickCopyModifier: getQuickCopyModifier(),
    defaultQuickCopyModifier: DEFAULT_QUICK_COPY_MODIFIER,
    hideOnBlur: getHideOnBlur(),
    defaultHideOnBlur: DEFAULT_HIDE_ON_BLUR,
  }))

  ipcMain.handle('settings:setShortcut', (_e, accelerator: string) => {
    const ok = applyShortcut(accelerator)
    if (ok) {
      setStoredShortcut(accelerator)
      return { ok: true }
    }
    // 등록 실패 — 이전에 저장된 단축키 복원.
    applyShortcut(getShortcut())
    return { ok: false, error: '이 단축키를 등록할 수 없습니다 (다른 앱이 사용 중일 수 있어요).' }
  })

  ipcMain.handle('settings:open', () => openSettingsWindow())
  ipcMain.handle('settings:closeSelf', (e) =>
    BrowserWindow.fromWebContents(e.sender)?.close(),
  )
  ipcMain.handle('settings:setQuickCopyModifier', (_e, modifier: QuickCopyModifier) => {
    setQuickCopyModifier(modifier)
  })
  ipcMain.handle('settings:setHideOnBlur', (_e, hideOnBlur: boolean) => {
    setHideOnBlur(hideOnBlur)
  })

  // 새 조합 녹화 중 전역 단축키를 일시 중단한다:
  // (a) 오버레이가 뜨지 않게 하고 (b) 렌더러까지 입력이 전달되게 한다.
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
  createToastWindow()

  createTray({
    onOpen: showWindow,
    onSettings: openSettingsWindow,
    onCleared: () => broadcastCleared(),
  })

  // 실시간 갱신: 캡처된 항목을 렌더러로 push.
  startClipboardWatcher((item) => {
    win?.webContents.send('clipboard:new', item)
    showToast('클립보드에 저장되었습니다.')
  })

  // 사용자 저장 단축키 등록 (기본 Ctrl/Cmd+Shift+V).
  const registered = applyShortcut(getShortcut())
  if (!registered) {
    console.warn(`[main] failed to register global shortcut "${getShortcut()}"`)
  }

  // macOS: 독 아이콘 숨김 — 트레이/오버레이 유틸리티.
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
})

// 모든 창이 닫혀도 트레이에서 계속 실행.
app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopClipboardWatcher()
  if (toastHideTimer) clearTimeout(toastHideTimer)
  destroyTray()
})
