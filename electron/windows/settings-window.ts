import { BrowserWindow } from 'electron'
import { hasActiveShortcut, restoreStoredShortcut } from '../shortcuts'
import { windowBackground } from '../theme'
import {
  WEB_PREFERENCES,
  keepVisibleOnMacFullscreen,
  loadRoute,
} from './shared'
import { getOverlayWindow } from './overlay'

const WIDTH = 460
const HEIGHT = 720
const MIN_WIDTH = 380
const MIN_HEIGHT = 480

let win: BrowserWindow | null = null

export function isSettingsVisible(): boolean {
  return win?.isVisible() ?? false
}

/** 설정 창을 연다. 이미 열려 있으면 앞으로 가져온다. */
export function openSettingsWindow(): void {
  if (win) {
    win.show()
    win.moveTop()
    win.focus()
    return
  }

  win = new BrowserWindow({
    parent: getOverlayWindow() ?? undefined,
    modal: false,
    width: WIDTH,
    height: HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    resizable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    title: '설정',
    backgroundColor: windowBackground(),
    autoHideMenuBar: true,
    webPreferences: WEB_PREFERENCES,
  })
  keepVisibleOnMacFullscreen(win)

  // 기본 File/Edit/View… 메뉴바 제거 — 단순한 설정 대화상자.
  win.removeMenu()

  loadRoute(win, 'settings')

  win.on('closed', () => {
    win = null
    // 안전장치: 단축키 녹화 중에 창이 닫히면 전역 단축키가 해제된 채 남는다.
    if (!hasActiveShortcut()) restoreStoredShortcut()
  })
}
