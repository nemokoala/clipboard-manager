import { nativeTheme } from 'electron'
import { getTheme } from './settings'

/** 창 배경색 — 렌더러가 패널을 그리기 전 한 프레임의 깜빡임을 막는 용도. */
export const DARK_BACKGROUND = '#1B1C1F'
export const LIGHT_BACKGROUND = '#FFFFFF'
export const TRANSPARENT_BACKGROUND = '#00000000'

/** 현재 설정된 테마가 실제로 다크로 보이는지 (system 이면 OS 설정을 따른다). */
export function isDarkTheme(): boolean {
  const theme = getTheme()
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return nativeTheme.shouldUseDarkColors
}

/** 지금 테마에 맞는 불투명 창 배경색. */
export function windowBackground(): string {
  return isDarkTheme() ? DARK_BACKGROUND : LIGHT_BACKGROUND
}
