import { BrowserWindow, app, screen } from 'electron'
import type { ClipboardItem } from '../../src/types'
import {
  MAX_MAIN_WINDOW_HEIGHT,
  MAX_MAIN_WINDOW_WIDTH,
  MIN_MAIN_WINDOW_HEIGHT,
  MIN_MAIN_WINDOW_WIDTH,
  getHideOnBlur,
  getMainWindowSize,
  setMainWindowSize,
} from '../settings'
import { TRANSPARENT_BACKGROUND, windowBackground } from '../theme'
import {
  WEB_PREFERENCES,
  keepVisibleOnMacFullscreen,
  loadRoute,
} from './shared'

const IS_MAC = process.platform === 'darwin'

let win: BrowserWindow | null = null

interface OverlayDeps {
  /** 설정 창이 떠 있으면 blur 로 오버레이를 닫지 않는다. */
  isSettingsVisible: () => boolean
}

export function getOverlayWindow(): BrowserWindow | null {
  return win
}

/** 새로 캡처된 항목을 오버레이 렌더러로 push 한다. */
export function sendNewItem(item: ClipboardItem): void {
  win?.webContents.send('clipboard:new', item)
}

export function createOverlayWindow({ isSettingsVisible }: OverlayDeps): void {
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
    // 블러(OS 재질) 없이 단순한 패널로 표시한다.
    //  - Windows: 불투명 창 + OS 기본 라운딩(roundedCorners).
    //  - macOS:   투명 창 + CSS 라운딩(패널은 React 쪽에서 불투명 배경으로 그린다).
    // acrylic 을 쓰면 창 열기 스케일 트랜지션과 닫기 시 직각 모서리가 생겨 제거했다.
    transparent: IS_MAC,
    backgroundColor: IS_MAC ? TRANSPARENT_BACKGROUND : windowBackground(),
    roundedCorners: true,
    hasShadow: true,
    webPreferences: WEB_PREFERENCES,
  })
  keepVisibleOnMacFullscreen(win)

  loadRoute(win)

  // 첫 실행 시 오버레이를 한 번 띄워 앱이 실행 중임을 알린다. 단, 로그인 자동 실행으로
  // 켜진 경우엔 조용히 트레이에만 머문다. (`show: false` 는 페인트 전 흰 화면을 막는다.)
  win.once('ready-to-show', () => {
    if (app.getLoginItemSettings().wasOpenedAtLogin) return
    showOverlay()
  })

  win.on('blur', () => {
    // 설정 버튼을 누르면 오버레이 blur 가 설정 창이 뜨기 *전에* 먼저 발생한다.
    // 한 tick 미루면 isSettingsVisible() 이 참을 볼 수 있어 오버레이가 닫히지 않는다.
    setTimeout(() => {
      if (!getHideOnBlur()) return
      if (isSettingsVisible()) return
      if (!win || win.webContents.isDevToolsOpened()) return
      hideOverlay()
    }, 0)
  })

  // 사용자가 조절한 창 크기를 다음 실행까지 기억한다.
  win.on('resized', () => {
    if (!win) return
    const [nextWidth, nextHeight] = win.getSize()
    setMainWindowSize(nextWidth, nextHeight)
  })
}

/** 커서가 있는 디스플레이 기준으로 가로 중앙·세로 1/3 지점에 배치한다. */
function positionOverlay(): void {
  if (!win) return
  const cursor = screen.getCursorScreenPoint()
  const { width, height, x, y } = screen.getDisplayNearestPoint(cursor).workArea
  const [winWidth, winHeight] = win.getSize()
  win.setPosition(
    Math.round(x + (width - winWidth) / 2),
    Math.round(y + (height - winHeight) / 3),
  )
}

export function showOverlay(): void {
  if (!win) return
  positionOverlay()
  // Windows 불투명 창 배경을 현재 테마에 맞춘다(패널이 그려지기 전 한 프레임 대비).
  if (!IS_MAC) win.setBackgroundColor(windowBackground())
  // hideOverlay 에서 투명하게 둔 것을 복원한다.
  win.setOpacity(1)
  win.show()
  win.focus()
}

/**
 * 오버레이를 숨긴다.
 * Windows DWM 의 창 닫기 애니메이션은 창을 직각 비트맵으로 스냅샷해 축소하기 때문에
 * roundedCorners 가 무시돼 모서리가 잠깐 직각으로 보인다. 숨기기 직전에 창을 투명하게
 * 만들어 그 직각 애니메이션이 눈에 띄지 않게 한다.
 */
export function hideOverlay(): void {
  if (!win) return
  win.setOpacity(0)
  win.hide()
}

export function toggleOverlay(): void {
  if (!win) return
  if (win.isVisible()) {
    hideOverlay()
    return
  }
  showOverlay()
}
