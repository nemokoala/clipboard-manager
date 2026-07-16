import { BrowserWindow, screen } from 'electron'
import { TRANSPARENT_BACKGROUND } from '../theme'
import {
  WEB_PREFERENCES,
  keepVisibleOnMacFullscreen,
  loadRoute,
} from './shared'

const WIDTH = 320
const HEIGHT = 56
/** 화면 하단에서 띄울 여백. */
const BOTTOM_MARGIN = 32
/** 렌더러(Toast.tsx)가 1200ms 에 페이드아웃을 시작하므로, 그 뒤에 창을 숨긴다. */
const DURATION_MS = 1400

let win: BrowserWindow | null = null
let ready = false
/** 창이 아직 로드 중일 때 들어온 메시지 — 로드가 끝나면 이걸 띄운다. */
let pendingMessage: string | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

export function createToastWindow(): void {
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: TRANSPARENT_BACKGROUND,
    webPreferences: WEB_PREFERENCES,
  })
  keepVisibleOnMacFullscreen(win)

  // 클릭이 토스트를 통과해 아래 창으로 전달되게 한다.
  win.setIgnoreMouseEvents(true)

  win.webContents.on('did-finish-load', () => {
    ready = true
    if (pendingMessage) {
      const message = pendingMessage
      pendingMessage = null
      showToast(message)
    }
  })

  win.on('closed', () => {
    win = null
    ready = false
  })

  loadRoute(win, 'toast')
}

/** 커서가 있는 디스플레이 하단 중앙에 잠깐 메시지를 띄운다. */
export function showToast(message: string): void {
  if (!win) {
    pendingMessage = message
    createToastWindow()
    return
  }
  if (!ready) {
    pendingMessage = message
    return
  }

  const cursor = screen.getCursorScreenPoint()
  const { width, height, x, y } = screen.getDisplayNearestPoint(cursor).workArea

  win.setPosition(
    Math.round(x + (width - WIDTH) / 2),
    Math.round(y + height - HEIGHT - BOTTOM_MARGIN),
  )
  win.webContents.send('toast:show', message)
  // 포커스를 뺏지 않아야 원래 쓰던 창의 입력이 끊기지 않는다.
  win.showInactive()
  win.moveTop()

  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    win?.hide()
    hideTimer = null
  }, DURATION_MS)
}

/** 앱 종료 시 타이머 정리. */
export function clearToastTimer(): void {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = null
}
