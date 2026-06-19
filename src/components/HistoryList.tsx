import type { ClipboardItem, QuickCopyModifier } from '../types'
import { groupByDay } from '../utils/format'
import { isMacLike } from '../utils/platform'
import DateGroup from './DateGroup'
import HistoryItem from './HistoryItem'

const IS_MAC = isMacLike()

interface HistoryListProps {
  items: ClipboardItem[]
  quickCopyModifier: QuickCopyModifier
  onCopy: (item: ClipboardItem) => void
  onDelete: (id: number) => void
}

function formatQuickCopyBadge(modifier: QuickCopyModifier, index: number): string | null {
  if (index > 9) return null

  const modifierLabel =
    modifier === 'primary'
      ? IS_MAC
        ? '⌘'
        : 'Ctrl'
      : modifier === 'alt'
        ? IS_MAC
          ? '⌥'
          : 'Alt'
        : IS_MAC
          ? '⇧'
          : 'Shift'
  const numberLabel = index === 9 ? '0' : String(index + 1)

  return `${modifierLabel} ${numberLabel}`
}

export default function HistoryList({
  items,
  quickCopyModifier,
  onCopy,
  onDelete,
}: HistoryListProps) {
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
  const itemIndexes = new Map(items.map((item, index) => [item.id, index]))

  return (
    <div className="flex-1 overflow-y-auto pb-3">
      {groups.map((group) => (
        <DateGroup key={group.key} label={group.label}>
          {group.items.map((item) => {
            const index = itemIndexes.get(item.id)
            return (
              <HistoryItem
                key={item.id}
                item={item}
                shortcutBadge={index === undefined ? null : formatQuickCopyBadge(quickCopyModifier, index)}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            )
          })}
        </DateGroup>
      ))}
    </div>
  )
}
