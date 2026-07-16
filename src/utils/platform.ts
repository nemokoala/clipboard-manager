/** 렌더러가 macOS 계열에서 실행 중인지. (navigator 가 없는 환경에서는 false) */
export function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false
  return /\b(Mac|iPhone|iPad|iPod)\b/.test(navigator.userAgent)
}
