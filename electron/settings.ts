import Store from 'electron-store'

/** 오버레이 토글용 기본 전역 단축키. */
export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+V'
export const DEFAULT_QUICK_COPY_MODIFIER = 'primary'

export type QuickCopyModifier = 'primary' | 'alt' | 'shift'

interface SettingsSchema {
  shortcut: string
  quickCopyModifier: QuickCopyModifier
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
