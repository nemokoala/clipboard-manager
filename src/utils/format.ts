import type { ClipboardItem } from '../types'

/** ISO 타임스탬프를 HH:mm(24시간) 형식으로 포맷한다. */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

/** 날짜를 자정으로 맞춰 일 단위 비교에 사용한다. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * 일 그룹용 라벨: "오늘", "어제", 또는 "6월 17일 (화)".
 */
export function formatDateGroupLabel(iso: string): string {
  const date = new Date(iso)
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const dayMs = 24 * 60 * 60 * 1000

  if (target === today) return '오늘'
  if (target === today - dayMs) return '어제'

  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAYS_KO[date.getDay()]
  return `${month}월 ${day}일 (${weekday})`
}

/** 그룹핑용 안정적인 일별 키 (로컬 시간 YYYY-MM-DD). */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface DayGroup {
  key: string
  label: string
  items: ClipboardItem[]
}

/** 항목(이미 최신순)을 순서 있는 일별 버킷으로 그룹한다. */
export function groupByDay(items: ClipboardItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  const index = new Map<string, DayGroup>()

  for (const item of items) {
    const key = dayKey(item.created_at)
    let group = index.get(key)
    if (!group) {
      group = {
        key,
        label: formatDateGroupLabel(item.created_at),
        items: [],
      }
      index.set(key, group)
      groups.push(group)
    }
    group.items.push(item)
  }

  return groups
}

/** 바이트 수를 소수점 1자리 MB로 포맷한다, 예: "2.4MB". */
export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
