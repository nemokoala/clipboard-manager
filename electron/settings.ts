import Store from 'electron-store'

/** Default global shortcut used to toggle the overlay. */
export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+V'

interface SettingsSchema {
  shortcut: string
}

// Lazily constructed: `new Store()` reads app.getPath('userData'), which is
// only valid after the app is ready.
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
