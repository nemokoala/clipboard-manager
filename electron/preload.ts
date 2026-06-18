import { contextBridge, ipcRenderer } from 'electron'
import type { ClipboardItem, SettingsData, SetShortcutResult } from '../src/types'

const clipboardAPI = {
  getItems: (): Promise<ClipboardItem[]> => ipcRenderer.invoke('db:getAll'),

  searchItems: (query: string): Promise<ClipboardItem[]> =>
    ipcRenderer.invoke('db:search', query),

  deleteItem: (id: number): Promise<void> => ipcRenderer.invoke('db:delete', id),

  deleteAll: (): Promise<void> => ipcRenderer.invoke('db:deleteAll'),

  getTotalSize: (): Promise<number> => ipcRenderer.invoke('db:totalSize'),

  copyToClipboard: (content: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:copy', content),

  /** 오버레이 창 숨기기 (항목 복사 후 사용). */
  hideWindow: (): Promise<void> => ipcRenderer.invoke('window:hide'),

  onNewItem: (callback: (item: ClipboardItem) => void): void => {
    ipcRenderer.on('clipboard:new', (_event, item: ClipboardItem) => callback(item))
  },

  removeNewItemListener: (): void => {
    ipcRenderer.removeAllListeners('clipboard:new')
  },

  /** 트레이 "전체 삭제"로 저장소가 비워질 때 발생. */
  onCleared: (callback: () => void): void => {
    ipcRenderer.on('clipboard:cleared', () => callback())
  },

  removeClearedListener: (): void => {
    ipcRenderer.removeAllListeners('clipboard:cleared')
  },

  // --- 설정 ---
  getSettings: (): Promise<SettingsData> => ipcRenderer.invoke('settings:get'),

  setShortcut: (accelerator: string): Promise<SetShortcutResult> =>
    ipcRenderer.invoke('settings:setShortcut', accelerator),

  openSettings: (): Promise<void> => ipcRenderer.invoke('settings:open'),

  /** 새 조합 녹화 중 전역 단축키 일시 중단/복원. */
  setRecording: (recording: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setRecording', recording),

  /** 이 렌더러를 소유한 창 닫기 (설정 창용). */
  closeSelf: (): Promise<void> => ipcRenderer.invoke('settings:closeSelf'),
}

contextBridge.exposeInMainWorld('clipboardAPI', clipboardAPI)

export type ClipboardAPI = typeof clipboardAPI
