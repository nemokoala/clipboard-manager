import type { ClipboardItem } from '../types'
import { formatTime } from '../utils/format'
import { pngDataUrlSize } from '../utils/image'
import { isMacLike } from '../utils/platform'

/** 미리보기 이미지의 최대 높이(px). */
const IMAGE_MAX_HEIGHT = 80

/**
 * 이미지 미리보기의 className/style.
 *
 * 크기를 알 수 있으면(PNG 헤더) 로드 전부터 최종 크기의 자리를 잡는다. 그래야 가상 스크롤이
 * 행을 처음 잴 때 이미 올바른 높이가 나온다. 이미지가 디코딩된 뒤 높이가 0 → 80px 로 바뀌면,
 * 위로 스크롤하는 중에는 라이브러리가 그 변화를 보정하지 않아 화면이 그만큼 튄다.
 *
 * 너비 = min(원본 너비, 내용 칸 너비, 최대 높이에 맞춘 너비), 높이는 aspect-ratio 로 따라간다.
 * max-width / max-height 로 원본 크기를 줄이는 것과 결과 크기가 같다.
 */
function imageBoxProps(preview: string) {
  const size = pngDataUrlSize(preview)
  if (!size) {
    // Tailwind 는 소스에서 클래스 문자열을 그대로 찾으므로 상수로 조합하지 않고 적는다.
    return { className: 'max-h-[80px] max-w-full rounded-lg object-contain' }
  }
  const fitHeightWidth = (IMAGE_MAX_HEIGHT * size.width) / size.height
  return {
    className: 'rounded-lg object-contain',
    style: {
      width: `min(${size.width}px, 100%, ${fitHeightWidth}px)`,
      aspectRatio: `${size.width} / ${size.height}`,
    },
  }
}

/** 카드를 클릭할 때 눌려 있던 보조키. */
export interface ClickModifiers {
  /** Shift — 기준 항목부터 여기까지 범위 선택 */
  range: boolean
  /** Ctrl(macOS ⌘) — 이 항목만 선택 토글 */
  toggle: boolean
}

interface HistoryItemProps {
  item: ClipboardItem
  shortcutBadge?: string | null
  selected: boolean
  onClick: (item: ClipboardItem, modifiers: ClickModifiers) => void
  onTogglePin: (item: ClipboardItem) => void
  onDelete: (id: number) => void
}

/** 압정 모양 아이콘. */
function PinIcon({
  className,
  filled,
}: {
  className: string
  filled: boolean
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5.76a2 2 0 0 0 .76 1.57l1.49 1.18A1 1 0 0 1 17.62 17H6.38a1 1 0 0 1-.63-1.49l1.49-1.18A2 2 0 0 0 9 10.76Z" />
    </svg>
  )
}

export default function HistoryItem({
  item,
  shortcutBadge,
  selected,
  onClick,
  onTogglePin,
  onDelete,
}: HistoryItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    onClick(item, {
      range: e.shiftKey,
      toggle: isMacLike() ? e.metaKey : e.ctrlKey,
    })
  }

  const handleDelete = (e: React.MouseEvent) => {
    // 부모 카드의 클릭(복사·선택)이 실행되지 않도록 한다.
    e.stopPropagation()
    onDelete(item.id)
  }

  const handleTogglePin = (e: React.MouseEvent) => {
    // 부모 카드의 클릭(복사·선택)이 실행되지 않도록 한다.
    e.stopPropagation()
    onTogglePin(item)
  }

  return (
    <div
      onClick={handleClick}
      data-selected={selected || undefined}
      // - 화면 밖 카드는 가상 스크롤(HistoryList)이 아예 그리지 않는다. content-visibility: auto
      //   를 다시 넣지 말 것 — 여유분으로 미리 그린 화면 밖 행이 contain-intrinsic-size 높이로
      //   측정돼 행 위치가 어긋난다.
      // - select-none: Shift+클릭 범위 선택 때 글자가 드래그 선택되지 않게 한다.
      // - 선택 표시는 ring(inset)과 배경으로만 한다. border 는 크기를 바꿔 행이 다시 측정된다.
      className={[
        'group relative flex cursor-pointer select-none items-start gap-3 rounded-xl p-3 transition',
        selected
          ? 'bg-toss-blue/10 ring-2 ring-inset ring-toss-blue/70 dark:bg-toss-blue/15'
          : 'bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10',
      ].join(' ')}
    >
      {/* 내용 미리보기 */}
      <div className="min-w-0 flex-1">
        {item.type === 'image' ? (
          <img
            src={item.preview}
            alt="클립보드 이미지"
            loading="lazy"
            decoding="async"
            {...imageBoxProps(item.preview)}
          />
        ) : item.type === 'link' ? (
          <div className="flex items-center gap-2">
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
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">
            {item.preview}
          </p>
        )}
      </div>

      {/*
        오른쪽 칸: 평소엔 시간·빠른 복사 번호, hover 하면 고정·삭제 버튼.
        둘을 grid 한 칸에 겹쳐 두고 visibility 만 바꾼다 — 자리는 둘 중 넓은 쪽으로 고정돼
        hover 해도 내용 폭(줄바꿈)과 카드 높이가 바뀌지 않는다. 높이는 본문 한 줄(20px)과 같다.
      */}
      <div className="grid shrink-0">
        <div className="col-start-1 row-start-1 flex h-5 items-center justify-end gap-1.5 group-hover:invisible">
          {item.pinned && <PinIcon className="h-3 w-3 text-toss-blue" filled />}
          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-500">
            {formatTime(item.created_at)}
          </span>
          {shortcutBadge && (
            <span className="rounded-md border border-gray-200 bg-white px-1.5 text-[10px] font-medium leading-4 text-gray-400 dark:border-white/10 dark:bg-black/20 dark:text-white/45">
              {shortcutBadge}
            </span>
          )}
        </div>
        <div className="invisible col-start-1 row-start-1 flex h-5 items-center justify-end gap-0.5 group-hover:visible">
          <button
            onClick={handleTogglePin}
            title={item.pinned ? '고정 해제' : '고정'}
            className={[
              'flex h-5 w-5 items-center justify-center rounded-md transition hover:bg-gray-200 dark:hover:bg-white/10',
              item.pinned
                ? 'text-toss-blue'
                : 'text-gray-400 hover:text-toss-blue dark:text-white/40',
            ].join(' ')}
          >
            <PinIcon className="h-3.5 w-3.5" filled={item.pinned} />
          </button>
          <button
            onClick={handleDelete}
            title="삭제"
            className="flex h-5 w-5 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-200 hover:text-red-500 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-red-300"
          >
            <svg
              className="h-3.5 w-3.5"
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
      </div>
    </div>
  )
}
