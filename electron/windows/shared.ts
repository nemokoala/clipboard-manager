import type { BrowserWindow } from 'electron'
import path from 'node:path'

// dist-electron/  ← 컴파일된 main + preload (CommonJS, __dirname 사용 가능)
// dist/           ← 컴파일된 렌더러
// 프로젝트 루트는 dist-electron 의 한 단계 위.
//
// 이 모듈은 창을 만드는 모든 모듈이 import 하므로, APP_ROOT 를 여기서 세팅해 두면
// (tray 처럼 process.env 로 읽는 곳 포함) 항상 먼저 채워진 상태가 보장된다.
process.env.APP_ROOT = path.join(__dirname, '..')

export const APP_ROOT = process.env.APP_ROOT
export const RENDERER_DIST = path.join(APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

/** 모든 창이 공유하는 preload + 보안 설정. */
export const WEB_PREFERENCES = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
} as const

/**
 * 같은 렌더러 번들을 URL 해시로 구분해 로드한다.
 * 해시 없음 = 오버레이, `settings` = 설정 창, `toast` = 토스트.
 */
export function loadRoute(win: BrowserWindow, hash?: string): void {
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(hash ? `${VITE_DEV_SERVER_URL}#${hash}` : VITE_DEV_SERVER_URL)
    return
  }
  const indexHtml = path.join(RENDERER_DIST, 'index.html')
  win.loadFile(indexHtml, hash ? { hash } : undefined)
}

/** macOS 에서 전체화면 앱 위에도 창이 뜨게 한다. */
export function keepVisibleOnMacFullscreen(win: BrowserWindow): void {
  if (process.platform !== 'darwin') return
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
}
