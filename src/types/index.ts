import type { ClipboardAPI } from '../../electron/preload'

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

/** 저장소 현황(검색/탭 필터와 무관한 DB 전체 기준). */
export interface StorageStats {
  itemCount: number
  totalBytes: number
}

/** 숫자 빠른 복사에 사용할 보조키. */
export type QuickCopyModifier = 'primary' | 'alt' | 'shift'

/** 테마 모드: 라이트 / 다크 / 시스템(OS 설정 추종). */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * 메인 프로세스가 반환하는 설정 데이터.
 * 각 항목은 현재 값과 내장 기본값("기본값으로" 버튼용)을 함께 담는다.
 */
export interface SettingsData {
  /** 전역 토글 단축키 (Electron accelerator 문자열). */
  shortcut: string
  defaultShortcut: string
  quickCopyModifier: QuickCopyModifier
  defaultQuickCopyModifier: QuickCopyModifier
  /** 포커스를 잃었을 때 오버레이를 자동으로 숨길지 여부. */
  hideOnBlur: boolean
  defaultHideOnBlur: boolean
  /** OS 로그인 시 앱을 자동 실행할지 여부. */
  launchAtLogin: boolean
  defaultLaunchAtLogin: boolean
  theme: ThemeMode
  defaultTheme: ThemeMode
  /** 자동 정리: 보관 기간(일). 0이면 기간 제한 없음. */
  retentionDays: number
  defaultRetentionDays: number
  /** 자동 정리: 최대 보관 개수. 0이면 개수 제한 없음. */
  maxItems: number
  defaultMaxItems: number
}

/** 단축키 변경 시도 결과. */
export interface SetShortcutResult {
  ok: boolean
  error?: string
}

// preload 가 실제로 노출하는 객체에서 타입을 파생시킨다(`typeof clipboardAPI`).
// 여기서 인터페이스를 손으로 다시 적으면 preload 와 조용히 어긋날 수 있다.
declare global {
  interface Window {
    clipboardAPI: ClipboardAPI
  }
}
