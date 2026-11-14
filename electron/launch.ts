import { app } from 'electron'

const HIDDEN_LAUNCH_ARG = '--hidden'

/**
 * OS 로그인 항목을 설정에 맞춘다.
 * Windows 는 실행 인자로, macOS 는 로그인 항목 옵션으로 창을 숨긴다.
 */
export function applyLaunchAtLogin(launchAtLogin: boolean): void {
  // Development Electron must never register its bare executable at login.
  if (!app.isPackaged) return

  app.setLoginItemSettings({
    openAtLogin: launchAtLogin,
    openAsHidden: launchAtLogin,
    ...(process.platform === 'win32' ? { args: [HIDDEN_LAUNCH_ARG] } : {}),
  })
}

export function shouldStartHidden(): boolean {
  return (
    process.argv.includes(HIDDEN_LAUNCH_ARG) ||
    (process.platform === 'darwin' &&
      app.getLoginItemSettings().wasOpenedAtLogin)
  )
}
