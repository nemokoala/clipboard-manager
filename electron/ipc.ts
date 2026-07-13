import { BrowserWindow, ipcMain } from 'electron'
import type { QuickCopyModifier, ThemeMode } from '../src/types'
import { broadcastCleared, broadcastTheme } from './broadcast'
import { writeToClipboard } from './clipboard'
import {
  deleteAll,
  deleteItem,
  getAllItems,
  getStorageStats,
  searchItems,
  setPinned,
} from './db'
import { runPurge } from './purge'
import {
  applyShortcut,
  restoreStoredShortcut,
  unregisterAllShortcuts,
} from './shortcuts'
import {
  DEFAULT_HIDE_ON_BLUR,
  DEFAULT_LAUNCH_AT_LOGIN,
  DEFAULT_MAX_ITEMS,
  DEFAULT_QUICK_COPY_MODIFIER,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_SHORTCUT,
  DEFAULT_THEME,
  getHideOnBlur,
  getLaunchAtLogin,
  getMaxItems,
  getQuickCopyModifier,
  getRetentionDays,
  getShortcut,
  getTheme,
  setHideOnBlur,
  setLaunchAtLogin,
  setMaxItems,
  setQuickCopyModifier,
  setRetentionDays,
  setStoredShortcut,
  setStoredTheme,
} from './settings'
import { applyLaunchAtLogin } from './launch'
import { hideOverlay } from './windows/overlay'
import { openSettingsWindow } from './windows/settings-window'
import { showToast } from './windows/toast'

/** 렌더러가 preload 를 통해 호출하는 모든 채널을 한곳에서 등록한다. */
export function registerIpc(): void {
  registerDbHandlers()
  registerWindowHandlers()
  registerSettingsHandlers()
}

function registerDbHandlers(): void {
  ipcMain.handle('db:getAll', () => getAllItems())
  ipcMain.handle('db:search', (_e, query: string) => searchItems(query))
  ipcMain.handle('db:setPinned', (_e, id: number, pinned: boolean) =>
    setPinned(id, pinned),
  )
  ipcMain.handle('db:delete', (_e, id: number) => deleteItem(id))
  ipcMain.handle('db:deleteAll', () => deleteAll())
  ipcMain.handle('db:stats', () => getStorageStats())
}

function registerWindowHandlers(): void {
  ipcMain.handle('clipboard:copy', (_e, content: string) => {
    writeToClipboard(content)
    showToast('복사되었습니다.')
  })
  ipcMain.handle('window:hide', () => hideOverlay())
  ipcMain.handle('settings:open', () => openSettingsWindow())
  ipcMain.handle('settings:closeSelf', (e) =>
    BrowserWindow.fromWebContents(e.sender)?.close(),
  )
}

function registerSettingsHandlers(): void {
  // 현재 값과 기본값을 함께 보낸다 — 설정 창의 "기본값으로" 버튼이 쓴다.
  ipcMain.handle('settings:get', () => ({
    shortcut: getShortcut(),
    defaultShortcut: DEFAULT_SHORTCUT,
    quickCopyModifier: getQuickCopyModifier(),
    defaultQuickCopyModifier: DEFAULT_QUICK_COPY_MODIFIER,
    hideOnBlur: getHideOnBlur(),
    defaultHideOnBlur: DEFAULT_HIDE_ON_BLUR,
    launchAtLogin: getLaunchAtLogin(),
    defaultLaunchAtLogin: DEFAULT_LAUNCH_AT_LOGIN,
    theme: getTheme(),
    defaultTheme: DEFAULT_THEME,
    retentionDays: getRetentionDays(),
    defaultRetentionDays: DEFAULT_RETENTION_DAYS,
    maxItems: getMaxItems(),
    defaultMaxItems: DEFAULT_MAX_ITEMS,
  }))

  ipcMain.handle('settings:setShortcut', (_e, accelerator: string) => {
    if (applyShortcut(accelerator)) {
      setStoredShortcut(accelerator)
      return { ok: true }
    }
    // 등록 실패 — 이전에 저장된 단축키를 되살린다.
    restoreStoredShortcut()
    return {
      ok: false,
      error: '이 단축키를 등록할 수 없습니다 (다른 앱이 사용 중일 수 있어요).',
    }
  })

  ipcMain.handle(
    'settings:setQuickCopyModifier',
    (_e, modifier: QuickCopyModifier) => setQuickCopyModifier(modifier),
  )

  ipcMain.handle('settings:setHideOnBlur', (_e, hideOnBlur: boolean) =>
    setHideOnBlur(hideOnBlur),
  )

  ipcMain.handle('settings:setLaunchAtLogin', (_e, launchAtLogin: boolean) => {
    setLaunchAtLogin(launchAtLogin)
    applyLaunchAtLogin(launchAtLogin)
  })

  ipcMain.handle('settings:setTheme', (_e, theme: ThemeMode) => {
    setStoredTheme(theme)
    broadcastTheme(theme)
  })

  // 보관 정책이 바뀌면 즉시 정리하고, 삭제분이 있으면 목록을 갱신시킨다.
  ipcMain.handle('settings:setRetentionDays', (_e, days: number) => {
    setRetentionDays(days)
    if (runPurge()) broadcastCleared()
  })

  ipcMain.handle('settings:setMaxItems', (_e, max: number) => {
    setMaxItems(max)
    if (runPurge()) broadcastCleared()
  })

  // 새 조합을 녹화하는 동안 전역 단축키를 잠시 내려둔다.
  ipcMain.handle('settings:setRecording', (_e, recording: boolean) => {
    if (recording) {
      unregisterAllShortcuts()
    } else {
      restoreStoredShortcut()
    }
  })
}
