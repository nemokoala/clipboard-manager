import Store from 'electron-store'

/** 오버레이 토글용 기본 전역 단축키. */
export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+V'
export const DEFAULT_QUICK_COPY_MODIFIER = 'primary'
export const DEFAULT_HIDE_ON_BLUR = true
export const DEFAULT_LAUNCH_AT_LOGIN = false
/** 테마 모드: 라이트 / 다크 / 시스템(OS 설정 추종). */
export type ThemeMode = 'light' | 'dark' | 'system'
export const DEFAULT_THEME: ThemeMode = 'system'
export const DEFAULT_MAIN_WINDOW_WIDTH = 480
export const DEFAULT_MAIN_WINDOW_HEIGHT = 600
export const MIN_MAIN_WINDOW_WIDTH = 360
export const MAX_MAIN_WINDOW_WIDTH = 760
export const MIN_MAIN_WINDOW_HEIGHT = 360
export const MAX_MAIN_WINDOW_HEIGHT = 900

export type QuickCopyModifier = 'primary' | 'alt' | 'shift'

interface SettingsSchema {
  shortcut: string
  quickCopyModifier: QuickCopyModifier
  hideOnBlur: boolean
  launchAtLogin: boolean
  theme: ThemeMode
  mainWindowWidth: number
  mainWindowHeight: number
}

// 지연 생성: `new Store()`는 app.getPath('userData')를 읽는데
// app ready 이후에만 유효하다.
let store: Store<SettingsSchema> | null = null

function getStore(): Store<SettingsSchema> {
  if (!store) {
    store = new Store<SettingsSchema>({
      defaults: {
        shortcut: DEFAULT_SHORTCUT,
        quickCopyModifier: DEFAULT_QUICK_COPY_MODIFIER,
        hideOnBlur: DEFAULT_HIDE_ON_BLUR,
        launchAtLogin: DEFAULT_LAUNCH_AT_LOGIN,
        theme: DEFAULT_THEME,
        mainWindowWidth: DEFAULT_MAIN_WINDOW_WIDTH,
        mainWindowHeight: DEFAULT_MAIN_WINDOW_HEIGHT,
      },
    })
  }
  return store
}

export function getShortcut(): string {
  return getStore().get('shortcut')
}

export function setStoredShortcut(shortcut: string): void {
  getStore().set('shortcut', shortcut)
}

export function getQuickCopyModifier(): QuickCopyModifier {
  return getStore().get('quickCopyModifier')
}

export function setQuickCopyModifier(modifier: QuickCopyModifier): void {
  if (!['primary', 'alt', 'shift'].includes(modifier)) return
  getStore().set('quickCopyModifier', modifier)
}

export function getHideOnBlur(): boolean {
  return getStore().get('hideOnBlur')
}

export function setHideOnBlur(hideOnBlur: boolean): void {
  getStore().set('hideOnBlur', hideOnBlur)
}

export function getTheme(): ThemeMode {
  return getStore().get('theme')
}

export function setStoredTheme(theme: ThemeMode): void {
  if (!['light', 'dark', 'system'].includes(theme)) return
  getStore().set('theme', theme)
}

export function getLaunchAtLogin(): boolean {
  return getStore().get('launchAtLogin')
}

export function setLaunchAtLogin(launchAtLogin: boolean): void {
  getStore().set('launchAtLogin', launchAtLogin)
}

function clampSize(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)))
}

export function getMainWindowSize(): { width: number; height: number } {
  const width = getStore().get('mainWindowWidth')
  const height = getStore().get('mainWindowHeight')
  return {
    width: clampSize(width, MIN_MAIN_WINDOW_WIDTH, MAX_MAIN_WINDOW_WIDTH),
    height: clampSize(height, MIN_MAIN_WINDOW_HEIGHT, MAX_MAIN_WINDOW_HEIGHT),
  }
}

export function setMainWindowSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return
  getStore().set(
    'mainWindowWidth',
    clampSize(width, MIN_MAIN_WINDOW_WIDTH, MAX_MAIN_WINDOW_WIDTH),
  )
  getStore().set(
    'mainWindowHeight',
    clampSize(height, MIN_MAIN_WINDOW_HEIGHT, MAX_MAIN_WINDOW_HEIGHT),
  )
}
