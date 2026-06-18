export type ClipboardType = 'text' | 'image' | 'link'

export interface ClipboardItem {
  id: number
  type: ClipboardType
  /** Plain text, a URL, or a `data:image/png;base64,...` string. */
  content: string
  /** Byte size of `content`. */
  size: number
  /** ISO8601 timestamp, e.g. 2025-06-19T14:30:00.000Z */
  created_at: string
}

/** Tab filter values used by the UI. */
export type TabFilter = 'all' | 'text' | 'image' | 'link'

/** Settings payload returned by the main process. */
export interface SettingsData {
  /** Currently saved global toggle shortcut (Electron accelerator string). */
  shortcut: string
  /** The built-in default, for the "기본값으로" button. */
  defaultShortcut: string
}

/** Result of attempting to change the shortcut. */
export interface SetShortcutResult {
  ok: boolean
  error?: string
}

/** Shape of the API exposed on `window.clipboardAPI` by the preload script. */
export interface ClipboardAPI {
  getItems: () => Promise<ClipboardItem[]>
  searchItems: (query: string) => Promise<ClipboardItem[]>
  deleteItem: (id: number) => Promise<void>
  deleteAll: () => Promise<void>
  getTotalSize: () => Promise<number>
  copyToClipboard: (content: string) => Promise<void>
  hideWindow: () => Promise<void>
  onNewItem: (callback: (item: ClipboardItem) => void) => void
  removeNewItemListener: () => void
  onCleared: (callback: () => void) => void
  removeClearedListener: () => void
  // Settings
  getSettings: () => Promise<SettingsData>
  setShortcut: (accelerator: string) => Promise<SetShortcutResult>
  openSettings: () => Promise<void>
  setRecording: (recording: boolean) => Promise<void>
  closeSelf: () => Promise<void>
}

declare global {
  interface Window {
    clipboardAPI: ClipboardAPI
  }
}
