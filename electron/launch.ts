import { app } from 'electron'

/**
 * OS 로그인 항목을 설정에 맞춘다.
 * `openAsHidden` 을 함께 켜서 부팅 직후 창이 튀어나오지 않고 트레이에만 머물게 한다.
 */
export function applyLaunchAtLogin(launchAtLogin: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: launchAtLogin,
    openAsHidden: launchAtLogin,
  })
}
