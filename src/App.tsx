import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClipboardItem, TabFilter } from './types'
import SearchBar from './components/SearchBar'
import TabBar from './components/TabBar'
import StorageBar from './components/StorageBar'
import HistoryList from './components/HistoryList'

export default function App() {
  const [items, setItems] = useState<ClipboardItem[]>([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<TabFilter>('all')
  const [totalSize, setTotalSize] = useState(0)

  const refreshSize = useCallback(async () => {
    const size = await window.clipboardAPI.getTotalSize()
    setTotalSize(size)
  }, [])

  const loadItems = useCallback(async () => {
    const data = query.trim()
      ? await window.clipboardAPI.searchItems(query.trim())
      : await window.clipboardAPI.getItems()
    setItems(data)
  }, [query])

  // 초기 로드 + 검색어 변경 시마다 다시 로드.
  useEffect(() => {
    loadItems()
    refreshSize()
  }, [loadItems, refreshSize])

  // 메인 프로세스에서 push하는 실시간 갱신.
  useEffect(() => {
    window.clipboardAPI.onNewItem(() => {
      // 현재 쿼리/필터를 다시 실행해 새 항목이 올바르게 반영되게 한다.
      loadItems()
      refreshSize()
    })
    // 트레이 "전체 삭제"로 저장소 비움 — 빈 목록으로 갱신.
    window.clipboardAPI.onCleared(() => {
      loadItems()
      refreshSize()
    })
    return () => {
      window.clipboardAPI.removeNewItemListener()
      window.clipboardAPI.removeClearedListener()
    }
  }, [loadItems, refreshSize])

  const handleCopy = useCallback(async (item: ClipboardItem) => {
    await window.clipboardAPI.copyToClipboard(item.content)
    await window.clipboardAPI.hideWindow()
  }, [])

  const handleDelete = useCallback(
    async (id: number) => {
      await window.clipboardAPI.deleteItem(id)
      await loadItems()
      await refreshSize()
    },
    [loadItems, refreshSize],
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

  // Escape로 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.clipboardAPI.hideWindow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 text-white/90 backdrop-blur-xl">
      <SearchBar
        value={query}
        onChange={setQuery}
        onClose={handleClose}
        onSettings={handleSettings}
      />
      <div className="h-px bg-white/10" />
      <TabBar active={tab} onChange={setTab} />
      <div className="h-px bg-white/10" />
      <StorageBar usedBytes={totalSize} />
      <div className="h-px bg-white/10" />
      <HistoryList items={visibleItems} onCopy={handleCopy} onDelete={handleDelete} />
    </div>
  )
}
