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

  /** Hide the overlay window (used after copying an item). */
  hideWindow: (): Promise<void> => ipcRenderer.invoke('window:hide'),

  onNewItem: (callback: (item: ClipboardItem) => void): void => {
    ipcRenderer.on('clipboard:new', (_event, item: ClipboardItem) => callback(item))
  },

  removeNewItemListener: (): void => {
    ipcRenderer.removeAllListeners('clipboard:new')
  },

  /** Fired when the tray's "전체 삭제" clears the store. */
  onCleared: (callback: () => void): void => {
    ipcRenderer.on('clipboard:cleared', () => callback())
  },

  removeClearedListener: (): void => {
    ipcRenderer.removeAllListeners('clipboard:cleared')
  },

  // --- Settings ---
  getSettings: (): Promise<SettingsData> => ipcRenderer.invoke('settings:get'),

  setShortcut: (accelerator: string): Promise<SetShortcutResult> =>
    ipcRenderer.invoke('settings:setShortcut', accelerator),

  openSettings: (): Promise<void> => ipcRenderer.invoke('settings:open'),

  /** Suspend/restore the global shortcut while recording a new combo. */
  setRecording: (recording: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setRecording', recording),

  /** Close the window that owns this renderer (used by the settings window). */
  closeSelf: (): Promise<void> => ipcRenderer.invoke('settings:closeSelf'),
}

contextBridge.exposeInMainWorld('clipboardAPI', clipboardAPI)

export type ClipboardAPI = typeof clipboardAPI
