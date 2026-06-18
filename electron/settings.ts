import Store from 'electron-store'

/** 오버레이 토글용 기본 전역 단축키. */
export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+V'

interface SettingsSchema {
  shortcut: string
}

// 지연 생성: `new Store()`는 app.getPath('userData')를 읽는데
// app ready 이후에만 유효하다.
let store: Store<SettingsSchema> | null = null

function getStore(): Store<SettingsSchema> {
  if (!store) {
    store = new Store<SettingsSchema>({
      defaults: { shortcut: DEFAULT_SHORTCUT },
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
