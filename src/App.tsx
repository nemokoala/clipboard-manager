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

  // Initial load + reload whenever the search query changes.
  useEffect(() => {
    loadItems()
    refreshSize()
  }, [loadItems, refreshSize])

  // Live updates pushed from the main process.
  useEffect(() => {
    window.clipboardAPI.onNewItem(() => {
      // Re-run the current query/filter so the new item lands correctly.
      loadItems()
      refreshSize()
    })
    // Tray "전체 삭제" cleared the store — refresh to empty.
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

  // Filter the loaded items by the active tab.
  const visibleItems = useMemo(() => {
    if (tab === 'all') return items
    return items.filter((item) => item.type === tab)
  }, [items, tab])

  // Close on Escape.
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
