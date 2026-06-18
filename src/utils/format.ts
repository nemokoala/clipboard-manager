import type { ClipboardItem } from '../types'

/** Format an ISO timestamp as HH:mm (24h). */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

/** Strip a date down to midnight for day-level comparisons. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Human label for a day group: "오늘", "어제", or "6월 17일 (화)".
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

/** A stable per-day key (YYYY-MM-DD in local time) used for grouping. */
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

/** Group items (already newest-first) into ordered day buckets. */
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

/** Format a byte count as MB with one decimal, e.g. "2.4MB". */
export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
