import { BrowserWindow } from 'electron'
import type { ThemeMode } from '../src/types'

// 열려 있는 모든 렌더러(오버레이 / 설정 / 토스트)에 한 번에 알린다.
// 창 참조를 따로 들고 다니지 않아도 되도록 getAllWindows() 를 쓴다.

/**
 * 목록을 다시 읽어야 함을 알린다.
 * 트레이 "전체 삭제", 보관 정책에 따른 자동 정리, 썸네일 백필 완료 시 발생한다.
 */
export function broadcastRefresh(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('clipboard:refresh')
  }
}

/** 테마 변경을 알린다 (설정 창에서 변경, 또는 시스템 테마 전환). */
export function broadcastTheme(theme: ThemeMode): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('theme:changed', theme)
  }
}
