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
  /** 즐겨찾기 고정 여부. 고정 항목은 목록 상단에 모이고 자동 정리에서 제외된다. */
  pinned: boolean
}

/** UI에서 쓰는 탭 필터 값. */
export type TabFilter = 'all' | 'text' | 'image' | 'link'

export type QuickCopyModifier = 'primary' | 'alt' | 'shift'

/** 테마 모드: 라이트 / 다크 / 시스템(OS 설정 추종). */
export type ThemeMode = 'light' | 'dark' | 'system'

/** 메인 프로세스가 반환하는 설정 데이터. */
export interface SettingsData {
  /** 현재 저장된 전역 토글 단축키 (Electron accelerator 문자열). */
  shortcut: string
  /** "기본값으로" 버튼용 내장 기본값. */
  defaultShortcut: string
  /** 숫자 빠른 복사에 사용할 보조키. */
  quickCopyModifier: QuickCopyModifier
  /** 숫자 빠른 복사 보조키 기본값. */
  defaultQuickCopyModifier: QuickCopyModifier
  /** 포커스를 잃었을 때 메인 창을 자동으로 숨길지 여부. */
  hideOnBlur: boolean
  /** 자동 숨김 기본값. */
  defaultHideOnBlur: boolean
  /** OS 로그인 시 앱을 자동 실행할지 여부. */
  launchAtLogin: boolean
  /** 자동 실행 기본값. */
  defaultLaunchAtLogin: boolean
  /** 현재 테마 모드. */
  theme: ThemeMode
  /** 테마 기본값. */
  defaultTheme: ThemeMode
  /** 자동 정리: 보관 기간(일). 0이면 기간 제한 없음. */
  retentionDays: number
  /** 보관 기간 기본값. */
  defaultRetentionDays: number
  /** 자동 정리: 최대 보관 개수. 0이면 개수 제한 없음. */
  maxItems: number
  /** 최대 보관 개수 기본값. */
  defaultMaxItems: number
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
  setPinned: (id: number, pinned: boolean) => Promise<void>
  deleteItem: (id: number) => Promise<void>
  deleteAll: () => Promise<void>
  getTotalSize: () => Promise<number>
  copyToClipboard: (content: string) => Promise<void>
  hideWindow: () => Promise<void>
  onNewItem: (callback: (item: ClipboardItem) => void) => void
  removeNewItemListener: () => void
  onCleared: (callback: () => void) => void
  removeClearedListener: () => void
  onToast: (callback: (message: string) => void) => void
  removeToastListener: () => void
  // 설정
  getSettings: () => Promise<SettingsData>
  setShortcut: (accelerator: string) => Promise<SetShortcutResult>
  setQuickCopyModifier: (modifier: QuickCopyModifier) => Promise<void>
  setHideOnBlur: (hideOnBlur: boolean) => Promise<void>
  setLaunchAtLogin: (launchAtLogin: boolean) => Promise<void>
  setRetentionDays: (days: number) => Promise<void>
  setMaxItems: (max: number) => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  onThemeChanged: (callback: (theme: ThemeMode) => void) => void
  removeThemeChangedListener: () => void
  openSettings: () => Promise<void>
  setRecording: (recording: boolean) => Promise<void>
  closeSelf: () => Promise<void>
}

declare global {
  interface Window {
    clipboardAPI: ClipboardAPI
  }
}
