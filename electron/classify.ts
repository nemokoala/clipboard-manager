import type { ClipboardType } from '../src/types'

/** 클립보드 텍스트가 링크인지 일반 텍스트인지 분류한다. */
export function classifyText(text: string): ClipboardType {
  return /^https?:\/\//i.test(text.trim()) ? 'link' : 'text'
}
