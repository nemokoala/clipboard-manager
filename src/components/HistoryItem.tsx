import type { ClipboardItem } from '../types'
import { formatTime } from '../utils/format'
import { pngDataUrlSize } from '../utils/image'

/** 미리보기 이미지의 최대 높이(px). */
const IMAGE_MAX_HEIGHT = 80
/** 오른쪽 고정·삭제 버튼 자리(4rem)를 비워 둔 최대 너비. */
const IMAGE_MAX_WIDTH = 'calc(100% - 4rem)'

/**
 * 이미지 미리보기의 className/style.
 *
 * 크기를 알 수 있으면(PNG 헤더) 로드 전부터 최종 크기의 자리를 잡는다. 그래야 가상 스크롤이
 * 행을 처음 잴 때 이미 올바른 높이가 나온다. 이미지가 디코딩된 뒤 높이가 0 → 80px 로 바뀌면,
 * 위로 스크롤하는 중에는 라이브러리가 그 변화를 보정하지 않아 화면이 그만큼 튄다.
 *
 * 너비 = min(원본 너비, 최대 너비, 최대 높이에 맞춘 너비), 높이는 aspect-ratio 로 따라간다.
 * max-width / max-height 로 원본 크기를 줄이던 기존 방식과 결과 크기가 같다.
 */
function imageBoxProps(preview: string) {
  const size = pngDataUrlSize(preview)
  if (!size) {
    // Tailwind 는 소스에서 클래스 문자열을 그대로 찾으므로 상수로 조합하지 않고 적는다.
    return {
      className:
        'max-h-[80px] max-w-[calc(100%-4rem)] rounded-lg object-contain',
    }
  }
  const fitHeightWidth = (IMAGE_MAX_HEIGHT * size.width) / size.height
  return {
    className: 'rounded-lg object-contain',
    style: {
      width: `min(${size.width}px, ${IMAGE_MAX_WIDTH}, ${fitHeightWidth}px)`,
      aspectRatio: `${size.width} / ${size.height}`,
    },
  }
}

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
      // 화면 밖 카드는 가상 스크롤(HistoryList)이 아예 그리지 않는다.
      // content-visibility: auto 를 다시 넣지 말 것 — 여유분으로 미리 그린 화면 밖 행이
      // contain-intrinsic-size 높이로 측정돼 행 위치가 어긋난다.
      className="group relative cursor-pointer rounded-xl bg-gray-50 p-3 transition hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10"
    >
      {/* 내용 미리보기 */}
      {item.type === 'image' ? (
        <img
          src={item.preview}
          alt="클립보드 이미지"
          loading="lazy"
          decoding="async"
          {...imageBoxProps(item.preview)}
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
