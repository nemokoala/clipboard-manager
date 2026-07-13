import type { QuickCopyModifier } from '../types'
import { isMacLike } from './platform'

// 단축키 관련 로직을 한곳에 모은다 — 표시 라벨(⌘/Ctrl…), keydown → Electron
// accelerator 변환, 빠른 복사 보조키 판정. 모두 DOM 에 의존하지 않는 순수 함수다.
// 플랫폼 분기는 `isMac` 인자로 주입받고, 기본값만 navigator 를 본다.

/** keydown 이벤트 중 이 모듈이 실제로 보는 필드만 추린 형태. */
export interface KeyEventLike {
  code: string
  key: string
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/** 보조키 표시 라벨 — [macOS 기호, 그 외 텍스트]. */
const MODIFIER_LABELS: Record<string, [mac: string, other: string]> = {
  primary: ['⌘', 'Ctrl'],
  CommandOrControl: ['⌘', 'Ctrl'],
  Super: ['⌘', 'Win'],
  alt: ['⌥', 'Alt'],
  Alt: ['⌥', 'Alt'],
  shift: ['⇧', 'Shift'],
  Shift: ['⇧', 'Shift'],
}

/** 빠른 복사 보조키의 표시 라벨 (예: '⌘' 또는 'Ctrl'). */
export function modifierLabel(
  modifier: QuickCopyModifier,
  isMac = isMacLike(),
): string {
  const [mac, other] = MODIFIER_LABELS[modifier]
  return isMac ? mac : other
}

/** Electron accelerator 를 사람이 읽는 형태로 (예: 'CommandOrControl+Shift+V' → '⌘ ⇧ V'). */
export function prettyAccelerator(
  accelerator: string,
  isMac = isMacLike(),
): string {
  return accelerator
    .split('+')
    .map((part) => {
      const label = MODIFIER_LABELS[part]
      if (!label) return part
      return isMac ? label[0] : label[1]
    })
    .join(isMac ? ' ' : ' + ')
}

/**
 * 목록 항목에 표시할 빠른 복사 뱃지 (예: '⌘ 3').
 * 1~9번째는 숫자 1~9, 10번째는 0에 대응하고 그 뒤로는 뱃지가 없다.
 */
export function quickCopyBadge(
  modifier: QuickCopyModifier,
  index: number,
  isMac = isMacLike(),
): string | null {
  if (index < 0 || index > 9) return null
  const number = index === 9 ? '0' : String(index + 1)
  return `${modifierLabel(modifier, isMac)} ${number}`
}

/** 플랫폼의 주 보조키(macOS ⌘ / 그 외 Ctrl)가 눌렸는지. */
export function hasPrimaryModifier(
  e: KeyEventLike,
  isMac = isMacLike(),
): boolean {
  return isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
}

/**
 * 설정된 빠른 복사 보조키가 **정확히** 눌렸는지 판정한다.
 * 다른 보조키가 함께 눌린 조합(예: 보조키가 Alt 인데 ⌘+Alt+1)은 오작동을 막기 위해 제외한다.
 */
export function hasQuickCopyModifier(
  e: KeyEventLike,
  modifier: QuickCopyModifier,
  isMac = isMacLike(),
): boolean {
  if (modifier === 'alt') {
    return e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey
  }
  if (modifier === 'shift') {
    return e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey
  }
  return hasPrimaryModifier(e, isMac) && !e.altKey && !e.shiftKey
}

/**
 * 숫자키 keydown 을 0-기반 목록 인덱스로 변환한다 (1~9 → 0~8, 0 → 9).
 * 숫자키가 아니면 null. 숫자패드도 지원한다.
 */
export function numberKeyToIndex(e: KeyEventLike): number | null {
  const fromCode = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1]
  const digit = fromCode ?? (/^\d$/.test(e.key) ? e.key : null)
  if (!digit) return null

  const itemNumber = digit === '0' ? 10 : Number(digit)
  return itemNumber - 1
}

/** accelerator 로 표기법이 다른 키들 (KeyboardEvent.code → Electron 키 이름). */
const CODE_TO_KEY: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Space: 'Space',
  Enter: 'Return',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Tab: 'Tab',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Backquote: '`',
}

/** KeyboardEvent.code 를 Electron accelerator 의 키 부분으로 변환한다. */
export function codeToKey(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]

  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code // F1~F24

  return CODE_TO_KEY[code] ?? null
}

/**
 * keydown 에서 Electron accelerator 를 만든다. 등록할 수 없는 조합이면 null.
 * 전역 단축키이므로 보조키(Ctrl/Cmd/Alt/Shift)가 최소 하나는 필요하다.
 */
export function eventToAccelerator(e: KeyEventLike): string | null {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (parts.length === 0) return null

  const key = codeToKey(e.code)
  if (!key) return null

  parts.push(key)
  return parts.join('+')
}
