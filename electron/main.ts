import { app, nativeTheme } from 'electron'
import path from 'node:path'
// APP_ROOT / RENDERER_DIST 를 세팅하므로 창 모듈보다 먼저 로드되어야 한다.
import './windows/shared'
import { broadcastTheme } from './broadcast'
import { startClipboardWatcher, stopClipboardWatcher } from './clipboard'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { applyLaunchAtLogin } from './launch'
import { runPurge } from './purge'
import { getLaunchAtLogin, getShortcut, getTheme } from './settings'
import { restoreStoredShortcut, unregisterAllShortcuts } from './shortcuts'
import { createTray, destroyTray } from './tray'
import {
  createOverlayWindow,
  sendNewItem,
  showOverlay,
} from './windows/overlay'
import {
  isSettingsVisible,
  openSettingsWindow,
} from './windows/settings-window'
import { clearToastTimer, createToastWindow, showToast } from './windows/toast'

app.whenReady().then(() => {
  // userData 는 app ready 이후에만 유효하므로 여기서 경로를 넘긴다.
  initDb(path.join(app.getPath('userData'), 'clipboard.db'))
  // 앱이 꺼져 있는 동안 쌓인 항목을 시작 시 한 번 정리한다.
  runPurge()
  applyLaunchAtLogin(getLaunchAtLogin())

  registerIpc()
  createOverlayWindow({ isSettingsVisible })
  createToastWindow()
  createTray({ onOpen: showOverlay, onSettings: openSettingsWindow })

  // 클립보드가 바뀔 때마다 저장 → 최대 개수 초과분 정리 → 오버레이에 push.
  startClipboardWatcher((item) => {
    runPurge()
    sendNewItem(item)
    showToast('클립보드에 저장되었습니다.')
  })

  if (!restoreStoredShortcut()) {
    console.warn(`[main] 전역 단축키 "${getShortcut()}" 등록에 실패했습니다.`)
  }

  // 테마가 'system' 일 때만 OS 다크/라이트 전환을 렌더러에 알린다.
  nativeTheme.on('updated', () => {
    if (getTheme() === 'system') broadcastTheme('system')
  })

  // macOS: 독 아이콘 숨김 — 트레이/오버레이 유틸리티 앱이므로.
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
})

// 모든 창이 닫혀도 트레이에 남아 계속 실행한다.
app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault()
})

app.on('will-quit', () => {
  unregisterAllShortcuts()
  stopClipboardWatcher()
  clearToastTimer()
  destroyTray()
})
