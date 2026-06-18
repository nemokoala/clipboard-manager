export type ClipboardType = 'text' | 'image' | 'link'

export interface ClipboardItem {
  id: number
  type: ClipboardType
  /** 일반 텍스트, URL, 또는 `data:image/png;base64,...` 문자열. */
  content: string
  /** `content`의 바이트 크기. */
  size: number
  /** ISO8601 타임스탬프, 예: 2025-06-19T14:30:00.000Z */
  created_at: string
}

/** UI에서 쓰는 탭 필터 값. */
export type TabFilter = 'all' | 'text' | 'image' | 'link'

/** 메인 프로세스가 반환하는 설정 데이터. */
export interface SettingsData {
  /** 현재 저장된 전역 토글 단축키 (Electron accelerator 문자열). */
  shortcut: string
  /** "기본값으로" 버튼용 내장 기본값. */
  defaultShortcut: string
}

/** 단축키 변경 시도 결과. */
export interface SetShortcutResult {
  ok: boolean
  error?: string
}

/** preload가 `window.clipboardAPI`에 노출하는 API 형태. */
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
  // 설정
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
