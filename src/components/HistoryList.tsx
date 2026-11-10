import { useVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { ClipboardItem, QuickCopyModifier } from '../types'
import { quickCopyBadge } from '../utils/accelerator'
import { groupByDay } from '../utils/format'
import DateGroupHeader from './DateGroup'
import HistoryItem, { type ClickModifiers } from './HistoryItem'

interface HistoryListProps {
  items: ClipboardItem[]
  quickCopyModifier: QuickCopyModifier
  /** 선택된 항목 id. 화면에 없는 id 가 섞여 있어도 무시된다. */
  selectedIds: ReadonlySet<number>
  /** 선택이 하나라도 있으면 날짜 헤더의 선택 버튼을 항상 보여준다. */
  selectionActive: boolean
  onItemClick: (item: ClipboardItem, modifiers: ClickModifiers) => void
  /** 날짜 그룹의 항목을 모두 선택하거나(일부만 선택돼 있어도) 모두 해제한다. */
  onToggleGroup: (items: ClipboardItem[]) => void
  onTogglePin: (item: ClipboardItem) => void
  onDelete: (id: number) => void
}

/**
 * 가상 스크롤의 한 행. 날짜 헤더와 카드를 한 줄로 펼친 목록이다.
 * - `index`: 빠른 복사 번호를 매기는 전체 목록(고정 우선) 기준 순서.
 * - `lastInGroup`: 그룹의 마지막 카드는 아래 여백이 그룹 간격(8px)이 된다.
 */
type Row =
  | {
      kind: 'header'
      key: string
      label: string
      /** 그룹에 속한 항목. 날짜 단위 선택에 쓴다. */
      items: ClipboardItem[]
      /** "고정됨" 그룹은 묶음 선택을 주지 않는다. */
      selectable: boolean
    }
  | {
      kind: 'item'
      key: string
      item: ClipboardItem
      index: number
      lastInGroup: boolean
    }

// 카드 사이 간격(gap-1.5)과 그룹 사이 간격(mb-2). 행의 아래 여백으로 재현한다.
const ITEM_GAP = 6
const GROUP_GAP = 8

/** 날짜별로 묶은 목록을 헤더 + 카드 행 배열로 펼친다. */
function buildRows(items: ClipboardItem[]): Row[] {
  const itemIndexes = new Map(items.map((item, index) => [item.id, index]))
  const rows: Row[] = []

  const pushGroup = (
    key: string,
    label: string,
    group: ClipboardItem[],
    selectable: boolean,
  ) => {
    rows.push({
      kind: 'header',
      key: `header:${key}`,
      label,
      items: group,
      selectable,
    })
    group.forEach((item, i) => {
      rows.push({
        kind: 'item',
        key: `item:${item.id}`,
        item,
        index: itemIndexes.get(item.id) ?? -1,
        lastInGroup: i === group.length - 1,
      })
    })
  }

  // 고정 항목은 날짜와 무관하게 상단 "고정됨" 그룹으로 모은다.
  const pinnedItems = items.filter((item) => item.pinned)
  if (pinnedItems.length > 0) pushGroup('pinned', '고정됨', pinnedItems, false)
  for (const group of groupByDay(items.filter((item) => !item.pinned))) {
    pushGroup(group.key, group.label, group.items, true)
  }
  return rows
}

/**
 * 렌더 전 높이 추정값(px). 실제 높이는 그린 뒤 measureElement 가 다시 잰다.
 * 추정이 실제와 가까울수록 처음 스크롤바 길이가 덜 출렁인다.
 */
function estimateRowSize(row: Row): number {
  if (row.kind === 'header') return 30.5
  const gap = row.lastInGroup ? GROUP_GAP : ITEM_GAP
  // 카드 = 패딩(24) + 본문. 시간은 오른쪽 칸에 있어 줄을 차지하지 않는다.
  if (row.item.type === 'image') return 24 + 80 + gap
  if (row.item.type === 'link') return 24 + 20 + gap
  // 텍스트는 최대 3줄(line-clamp-3). 줄바꿈 수와 길이(한 줄 ≈ 40자)로 어림한다.
  const text = row.item.preview
  const breaks = text.slice(0, 400).split('\n').length
  const lines = Math.min(3, Math.max(breaks, Math.ceil(text.length / 40)))
  return 24 + 20 * lines + gap
}

export default function HistoryList({
  items,
  quickCopyModifier,
  selectedIds,
  selectionActive,
  onItemClick,
  onToggleGroup,
  onTogglePin,
  onDelete,
}: HistoryListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => buildRows(items), [items])

  // 화면에 보이는 행(+ 위아래 여유분)만 DOM 에 둔다. 이미지가 수백 장이어도
  // 화면 밖 카드와 디코딩된 이미지를 붙잡고 있지 않게 하기 위함이다.
  // 이 경고는 React Compiler 가 이 컴포넌트를 자동 메모이제이션하지 않는다는 안내다.
  // 이 프로젝트는 React Compiler 를 쓰지 않으므로 동작에 영향이 없다.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => estimateRowSize(rows[i]),
    // 항목이 추가·삭제돼 순서가 밀려도 이미 잰 높이를 행 키로 다시 찾게 한다.
    getItemKey: (i) => rows[i].key,
    // 기본 측정은 높이를 Math.round 한다. 헤더·카드는 11px 글자 × 줄높이 1.5 때문에
    // 30.5px 처럼 0.5 단위로 끝나서, 반올림하면 행마다 0.5px 씩 벌어지고 전체가
    // 수백 px 길어진다. 소수 높이를 그대로 쓴다.
    measureElement: (element, entry) =>
      entry?.borderBoxSize?.[0]?.blockSize ??
      element.getBoundingClientRect().height,
    overscan: 6,
  })

  // 화면 위쪽(시작점이 뷰포트 위)에 있는 행의 높이가 바뀌면 그만큼 스크롤을 보정해
  // 보이는 내용이 밀리지 않게 한다. 라이브러리 기본값은 위로 스크롤하는 중의 재측정을
  // 보정하지 않는데, 창 폭을 바꾼 뒤 위로 스크롤하면 예전 폭에서 잰 행들이 다시 재지면서
  // 화면이 수십~백여 px 씩 튄다. 카드는 그려진 뒤 스스로 커지지 않으므로(채팅 스트리밍 등
  // 없음) 방향과 상관없이 보정해도 된다.
  useLayoutEffect(() => {
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (
      item,
      _delta,
      instance,
    ) => item.start < (instance.scrollOffset ?? 0)
  }, [virtualizer])

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-gray-300 dark:text-gray-600">
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

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto pb-3">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {row.kind === 'header' ? (
                <DateGroupHeader
                  label={row.label}
                  selection={
                    row.selectable
                      ? {
                          allSelected: row.items.every((item) =>
                            selectedIds.has(item.id),
                          ),
                          alwaysVisible: selectionActive,
                          onToggle: () => onToggleGroup(row.items),
                        }
                      : undefined
                  }
                />
              ) : (
                <div
                  className="px-3"
                  style={{
                    paddingBottom: row.lastInGroup ? GROUP_GAP : ITEM_GAP,
                  }}
                >
                  <HistoryItem
                    item={row.item}
                    shortcutBadge={
                      row.index < 0
                        ? null
                        : quickCopyBadge(quickCopyModifier, row.index)
                    }
                    selected={selectedIds.has(row.item.id)}
                    onClick={onItemClick}
                    onTogglePin={onTogglePin}
                    onDelete={onDelete}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
