import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ClipboardItem,
  QuickCopyModifier,
  StorageStats,
  TabFilter,
} from './types'
import SearchBar from './components/SearchBar'
import TabBar from './components/TabBar'
import StorageInfo from './components/StorageInfo'
import SelectionBar from './components/SelectionBar'
import HistoryList from './components/HistoryList'
import type { ClickModifiers } from './components/HistoryItem'
import {
  hasPrimaryModifier,
  hasQuickCopyModifier,
  numberKeyToIndex,
} from './utils/accelerator'
import { isMacLike } from './utils/platform'

const EMPTY_STATS: StorageStats = { itemCount: 0, totalBytes: 0 }

export default function App() {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<TabFilter>('all')
  const [stats, setStats] = useState<StorageStats>(EMPTY_STATS)
  const [quickCopyModifier, setQuickCopyModifier] =
    useState<QuickCopyModifier>('primary')
  // 다중 선택. 화면에 없는 id 가 남아 있을 수 있어 실제로는 selectedVisible 을 쓴다.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  // Shift+클릭 범위 선택의 기준 항목(마지막으로 클릭한 항목).
  const [anchorId, setAnchorId] = useState<number | null>(null)

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setAnchorId(null)
  }, [])

  const refreshStats = useCallback(async () => {
    setStats(await window.clipboardAPI.getStorageStats())
  }, [])

  const loadItems = useCallback(async () => {
    const data = query.trim()
      ? await window.clipboardAPI.searchItems(query.trim())
      : await window.clipboardAPI.getItems()
    setItems(data)
  }, [query])

  const loadSettings = useCallback(() => {
    void window.clipboardAPI.getSettings().then((settings) => {
      setQuickCopyModifier(settings.quickCopyModifier)
    })
  }, [])

  // 초기 로드 + 검색어 변경 시마다 다시 로드.
  useEffect(() => {
    // 둘 다 async 라 setState 는 IPC 응답 이후에 일어난다 — effect 본문에서 동기적으로
    // 호출되지 않는다. 규칙이 호출부만 보고 잡는 보수적 경고라 이 줄만 해제한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems()
    refreshStats()
  }, [loadItems, refreshStats])

  useEffect(() => {
    loadSettings()
    window.addEventListener('focus', loadSettings)
    return () => window.removeEventListener('focus', loadSettings)
  }, [loadSettings])

  // 메인 프로세스에서 push하는 실시간 갱신.
  useEffect(() => {
    window.clipboardAPI.onNewItem(() => {
      // 현재 쿼리/필터를 다시 실행해 새 항목이 올바르게 반영되게 한다.
      loadItems()
      refreshStats()
    })
    // 전체 삭제 / 자동 정리 / 썸네일 백필 완료 — 목록을 다시 읽는다.
    window.clipboardAPI.onRefresh(() => {
      loadItems()
      refreshStats()
    })
    return () => {
      window.clipboardAPI.removeNewItemListener()
      window.clipboardAPI.removeRefreshListener()
    }
  }, [loadItems, refreshStats])

  const handleCopy = useCallback(async (item: ClipboardItem) => {
    // 내용이 아니라 id 를 넘긴다 — 이미지 원본은 메인 프로세스에만 있다.
    await window.clipboardAPI.copyToClipboard(item.id)
    await window.clipboardAPI.hideWindow()
  }, [])

  const handleTogglePin = useCallback(
    async (item: ClipboardItem) => {
      await window.clipboardAPI.setPinned(item.id, !item.pinned)
      await loadItems()
    },
    [loadItems],
  )

  const handleDelete = useCallback(
    async (id: number) => {
      await window.clipboardAPI.deleteItem(id)
      await loadItems()
      await refreshStats()
    },
    [loadItems, refreshStats],
  )

  const handleClose = useCallback(() => {
    window.clipboardAPI.hideWindow()
  }, [])

  const handleSettings = useCallback(() => {
    window.clipboardAPI.openSettings()
  }, [])

  // 활성 탭으로 로드된 항목 필터.
  const visibleItems = useMemo(() => {
    if (tab === 'all') return items
    return items.filter((item) => item.type === tab)
  }, [items, tab])

  // 화면에 그려지는 순서(고정 항목 먼저). Shift 범위 선택은 이 순서를 따른다.
  const displayOrder = useMemo(
    () => [
      ...visibleItems.filter((item) => item.pinned),
      ...visibleItems.filter((item) => !item.pinned),
    ],
    [visibleItems],
  )

  // 실제 선택 = 선택한 id 중 지금 화면에 있는 것. 새 항목·자동 정리로 목록이 다시
  // 로드되면 사라진 id 는 여기서 자연히 빠진다 — 보이지 않는 항목은 절대 지우지 않는다.
  const selectedVisible = useMemo(
    () => displayOrder.filter((item) => selectedIds.has(item.id)),
    [displayOrder, selectedIds],
  )
  const selectionActive = selectedVisible.length > 0

  // 검색어·탭이 바뀌면 보이는 목록이 달라지므로 선택을 비운다.
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      clearSelection()
    },
    [clearSelection],
  )
  const handleTabChange = useCallback(
    (value: TabFilter) => {
      setTab(value)
      clearSelection()
    },
    [clearSelection],
  )

  // 오버레이는 닫힐 때 파기되지 않고 숨겨지기만 한다. 선택이 남으면 다음에 열었을 때
  // 첫 클릭이 복사가 아니라 선택 토글이 되므로, 숨겨지는 순간 비운다.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) clearSelection()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [clearSelection])

  /**
   * 카드 클릭.
   * - 선택이 없고 보조키도 없으면 지금처럼 복사 후 닫는다.
   * - Ctrl(⌘)+클릭: 그 항목만 선택 토글.
   * - Shift+클릭: 기준 항목부터 여기까지 범위를 선택에 더한다(기준이 없으면 그 항목만 선택).
   * - 선택이 하나라도 있으면 일반 클릭도 토글 — 여러 개 고르다가 실수로 복사·닫히지 않게.
   */
  const handleItemClick = useCallback(
    (item: ClipboardItem, { range, toggle }: ClickModifiers) => {
      if (!range && !toggle && !selectionActive) {
        void handleCopy(item)
        return
      }

      const next = new Set(selectedVisible.map((selected) => selected.id))
      const ids = displayOrder.map((visible) => visible.id)
      const from = anchorId === null ? -1 : ids.indexOf(anchorId)
      const to = ids.indexOf(item.id)

      if (range && selectionActive && from >= 0 && to >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from]
        for (const id of ids.slice(start, end + 1)) next.add(id)
      } else if (range) {
        next.add(item.id)
      } else if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
      }

      setSelectedIds(next)
      setAnchorId(item.id)
    },
    [anchorId, displayOrder, handleCopy, selectedVisible, selectionActive],
  )

  /** 날짜 그룹 선택: 하나라도 빠져 있으면 모두 선택, 이미 모두 선택돼 있으면 모두 해제. */
  const handleToggleGroup = useCallback(
    (groupItems: ClipboardItem[]) => {
      const next = new Set(selectedVisible.map((selected) => selected.id))
      const allSelected = groupItems.every((item) => next.has(item.id))
      for (const item of groupItems) {
        if (allSelected) next.delete(item.id)
        else next.add(item.id)
      }
      setSelectedIds(next)
    },
    [selectedVisible],
  )

  const handleDeleteSelected = useCallback(async () => {
    const ids = selectedVisible.map((item) => item.id)
    if (ids.length === 0) return
    await window.clipboardAPI.deleteItems(ids)
    clearSelection()
    await loadItems()
    await refreshStats()
  }, [clearSelection, loadItems, refreshStats, selectedVisible])

  // Escape로 닫고(선택이 있으면 선택부터 해제), ⌘/Ctrl + , 로 설정 창을 연다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectionActive) clearSelection()
        else void window.clipboardAPI.hideWindow()
        return
      }

      if (
        hasPrimaryModifier(e) &&
        !e.altKey &&
        !e.shiftKey &&
        e.code === 'Comma'
      ) {
        e.preventDefault()
        e.stopPropagation()
        void window.clipboardAPI.openSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection, selectionActive])

  // 설정된 보조키 + 숫자로 보이는 순서의 항목을 바로 복사한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasQuickCopyModifier(e, quickCopyModifier)) return

      const index = numberKeyToIndex(e)
      if (index === null) return

      const item = visibleItems[index]
      if (!item) return

      e.preventDefault()
      e.stopPropagation()
      void handleCopy(item)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCopy, quickCopyModifier, visibleItems])

  return (
    <div
      className={[
        'flex h-full flex-col overflow-hidden bg-white text-gray-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-ink dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
        // macOS(투명 창)는 CSS 로 둥글린다. Windows(불투명 창)는
        // OS 라운딩에 맡겨 모서리가 이중으로 보이지 않게 한다.
        isMacLike() ? 'rounded-[20px]' : 'rounded-none',
      ].join(' ')}
    >
      <SearchBar
        value={query}
        onChange={handleQueryChange}
        onClose={handleClose}
        onSettings={handleSettings}
      />
      <div className="h-px bg-gray-100 dark:bg-white/[0.08]" />
      <TabBar active={tab} onChange={handleTabChange} />
      <div className="h-px bg-gray-100 dark:bg-white/[0.08]" />
      {selectionActive ? (
        <SelectionBar
          count={selectedVisible.length}
          onClear={clearSelection}
          onDelete={() => void handleDeleteSelected()}
        />
      ) : (
        <StorageInfo stats={stats} />
      )}
      <div className="h-px bg-gray-100 dark:bg-white/[0.08]" />
      <HistoryList
        items={visibleItems}
        quickCopyModifier={quickCopyModifier}
        selectedIds={selectedIds}
        selectionActive={selectionActive}
        onItemClick={handleItemClick}
        onToggleGroup={handleToggleGroup}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
      />
    </div>
  )
}
