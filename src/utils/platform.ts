export function isMacLike(): boolean {
  return /\b(Mac|iPhone|iPad|iPod)\b/.test(navigator.userAgent)
}
