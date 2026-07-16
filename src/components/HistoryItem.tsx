import type { ClipboardItem } from '../types'
import { formatTime } from '../utils/format'

interface HistoryItemProps {
  item: ClipboardItem
  shortcutBadge?: string | null
  onCopy: (item: ClipboardItem) => void
  onTogglePin: (item: ClipboardItem) => void
  onDelete: (id: number) => void
}

export default function HistoryItem({
  item,
  shortcutBadge,
  onCopy,
  onTogglePin,
  onDelete,
}: HistoryItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    // 부모 카드의 클릭-복사가 실행되지 않도록 한다.
    e.stopPropagation()
    onDelete(item.id)
  }

  const handleTogglePin = (e: React.MouseEvent) => {
    // 카드 클릭-복사가 실행되지 않도록 한다.
    e.stopPropagation()
    onTogglePin(item)
  }

  return (
    <div
      onClick={() => onCopy(item)}
      // content-visibility: auto — 화면 밖 항목은 레이아웃·페인트를 건너뛴다.
      // contain-intrinsic-size 로 대략적인 높이를 알려 줘야 스크롤바가 튀지 않는다
      // (auto = 한 번 그려진 뒤로는 실제 높이를 기억한다).
      className="group relative cursor-pointer rounded-xl bg-gray-50 p-3 transition [contain-intrinsic-size:auto_96px] [content-visibility:auto] hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10"
    >
      {/* 내용 미리보기 */}
      {item.type === 'image' ? (
        <img
          src={item.preview}
          alt="클립보드 이미지"
          loading="lazy"
          decoding="async"
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
          <span className="truncate text-sm font-medium text-toss-blue">
            {item.preview}
          </span>
        </div>
      ) : (
        <p className="line-clamp-3 whitespace-pre-wrap break-words pr-16 text-sm text-gray-800 dark:text-gray-100">
          {item.preview}
        </p>
      )}

      {/* 하단: 시간 */}
      <div className="mt-2 pr-16 text-[11px] text-gray-500 dark:text-gray-500">
        {formatTime(item.created_at)}
      </div>

      {shortcutBadge && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium leading-4 text-gray-400 dark:border-white/10 dark:bg-black/20 dark:text-white/45">
          {shortcutBadge}
        </div>
      )}

      {/* 고정 버튼 — 고정된 항목은 항상 표시, 그 외엔 hover 시 표시 */}
      <button
        onClick={handleTogglePin}
        title={item.pinned ? '고정 해제' : '고정'}
        className={[
          'absolute right-9 top-2 flex h-6 w-6 items-center justify-center rounded-lg transition',
          item.pinned
            ? 'text-toss-blue opacity-100 hover:bg-gray-200 dark:hover:bg-white/10'
            : 'text-gray-400 opacity-0 hover:bg-gray-200 hover:text-toss-blue group-hover:opacity-100 dark:text-white/40 dark:hover:bg-white/10',
        ].join(' ')}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill={item.pinned ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 압정 모양 아이콘 */}
          <path d="M12 17v5" />
          <path d="M9 10.76V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5.76a2 2 0 0 0 .76 1.57l1.49 1.18A1 1 0 0 1 17.62 17H6.38a1 1 0 0 1-.63-1.49l1.49-1.18A2 2 0 0 0 9 10.76Z" />
        </svg>
      </button>

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
