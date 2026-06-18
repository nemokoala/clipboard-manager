import type { ClipboardItem } from '../types'
import { groupByDay } from '../utils/format'
import DateGroup from './DateGroup'
import HistoryItem from './HistoryItem'

interface HistoryListProps {
  items: ClipboardItem[]
  onCopy: (item: ClipboardItem) => void
  onDelete: (id: number) => void
}

export default function HistoryList({ items, onCopy, onDelete }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-white/30">
        <svg
          className="h-10 w-10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
        <p className="text-sm">기록이 없습니다</p>
      </div>
    )
  }

  const groups = groupByDay(items)

  return (
    <div className="flex-1 overflow-y-auto pb-3">
      {groups.map((group) => (
        <DateGroup key={group.key} label={group.label}>
          {group.items.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              onCopy={onCopy}
              onDelete={onDelete}
            />
          ))}
        </DateGroup>
      ))}
    </div>
  )
}
