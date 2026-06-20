import type { ThemeMode } from '../types'

// 모든 렌더러 창(오버레이/설정/토스트)에서 공유하는 테마 적용 로직.
// `dark` 클래스를 <html> 에 토글해 Tailwind 의 다크 변형을 활성화한다.

let currentMode: ThemeMode = 'system'
let mql: MediaQueryList | null = null

/** 모드를 실제 표시 테마로 변환한다(system 이면 OS 설정을 따른다). */
function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

/** 현재 모드를 DOM 에 반영한다. */
function apply(mode: ThemeMode): void {
  const resolved = resolve(mode)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  // 네이티브 폼 컨트롤/스크롤바 색도 함께 맞춘다.
  root.style.colorScheme = resolved
}

/** system 모드일 때만 OS 테마 변경에 반응한다. */
function handleSystemChange(): void {
  if (currentMode === 'system') apply('system')
}

/** 새 테마 모드를 적용한다(설정 변경/창 간 전파 시 호출). */
export function setTheme(mode: ThemeMode): void {
  currentMode = mode
  apply(mode)
}

/** 렌더러 시작 시 1회 호출 — 초기 테마 적용 + 시스템 변경 구독. */
export function initTheme(initialMode: ThemeMode): void {
  currentMode = initialMode
  if (!mql) {
    mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', handleSystemChange)
  }
  apply(initialMode)
}
