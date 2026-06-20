import type { ClipboardItem } from '../types'
import { formatTime } from '../utils/format'

interface HistoryItemProps {
  item: ClipboardItem
  shortcutBadge?: string | null
  onCopy: (item: ClipboardItem) => void
  onDelete: (id: number) => void
}

export default function HistoryItem({
  item,
  shortcutBadge,
  onCopy,
  onDelete,
}: HistoryItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    // 부모 카드의 클릭-복사가 실행되지 않도록 한다.
    e.stopPropagation()
    onDelete(item.id)
  }

  return (
    <div
      onClick={() => onCopy(item)}
      className="group relative cursor-pointer rounded-xl bg-gray-50 p-3 transition hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10"
    >
      {/* 내용 미리보기 */}
      {item.type === 'image' ? (
        <img
          src={item.content}
          alt="clipboard image"
          className="max-h-[80px] max-w-[calc(100%-4rem)] rounded-lg object-contain"
        />
      ) : item.type === 'link' ? (
        <div className="flex items-center gap-2 pr-16">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-toss-blue"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="truncate text-sm font-medium text-toss-blue">{item.content}</span>
        </div>
      ) : (
        <p className="line-clamp-3 whitespace-pre-wrap break-words pr-16 text-sm text-gray-800 dark:text-gray-100">
          {item.content}
        </p>
      )}

      {/* 하단: 시간 */}
      <div className="mt-2 pr-16 text-[11px] text-gray-500 dark:text-gray-500">{formatTime(item.created_at)}</div>

      {shortcutBadge && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium leading-4 text-gray-400 dark:border-white/10 dark:bg-black/20 dark:text-white/45">
          {shortcutBadge}
        </div>
      )}

      {/* 삭제 버튼 — hover 시 표시 */}
      <button
        onClick={handleDelete}
        title="삭제"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-red-500 group-hover:opacity-100 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-300"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  )
}
