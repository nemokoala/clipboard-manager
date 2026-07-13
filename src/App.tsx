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
import HistoryList from './components/HistoryList'
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

  // Escape로 닫고, ⌘/Ctrl + , 로 설정 창을 연다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void window.clipboardAPI.hideWindow()
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
  }, [])

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
        onChange={setQuery}
        onClose={handleClose}
        onSettings={handleSettings}
      />
      <div className="h-px bg-gray-100 dark:bg-white/[0.08]" />
      <TabBar active={tab} onChange={setTab} />
      <div className="h-px bg-gray-100 dark:bg-white/[0.08]" />
      <StorageInfo stats={stats} />
      <div className="h-px bg-gray-100 dark:bg-white/[0.08]" />
      <HistoryList
        items={visibleItems}
        quickCopyModifier={quickCopyModifier}
        onCopy={handleCopy}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
      />
    </div>
  )
}
