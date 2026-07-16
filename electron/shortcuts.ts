import { globalShortcut } from 'electron'
import { getShortcut } from './settings'
import { toggleOverlay } from './windows/overlay'

/** OS 에 현재 등록된 accelerator (교체·복원 시 참조). */
let activeShortcut = ''

export function hasActiveShortcut(): boolean {
  return activeShortcut !== ''
}

/**
 * `accelerator` 를 전역 토글 단축키로 등록하고 이전 등록분을 교체한다.
 * OS 가 거부하면(다른 앱이 이미 쓰는 조합 등) false — 호출자가 처리해야 한다.
 */
export function applyShortcut(accelerator: string): boolean {
  if (activeShortcut) {
    globalShortcut.unregister(activeShortcut)
    activeShortcut = ''
  }

  try {
    if (globalShortcut.register(accelerator, toggleOverlay)) {
      activeShortcut = accelerator
      return true
    }
  } catch {
    // 형식이 잘못된 accelerator — 아래에서 false 를 반환한다.
  }
  return false
}

/** 저장된 단축키로 되돌린다. */
export function restoreStoredShortcut(): boolean {
  return applyShortcut(getShortcut())
}

/**
 * 등록된 전역 단축키를 모두 해제한다. 두 곳에서 쓴다.
 * - 설정 창에서 새 조합을 녹화하는 동안: 그래야 (a) 오버레이가 뜨지 않고
 *   (b) 누른 조합이 렌더러까지 도달한다. 녹화가 끝나면 restoreStoredShortcut() 로 복구.
 * - 앱 종료 시 정리.
 */
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll()
  activeShortcut = ''
}
