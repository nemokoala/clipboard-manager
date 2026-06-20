import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClipboardItem, QuickCopyModifier, TabFilter } from "./types";
import SearchBar from "./components/SearchBar";
import TabBar from "./components/TabBar";
import StorageBar from "./components/StorageBar";
import HistoryList from "./components/HistoryList";
import { isMacLike } from "./utils/platform";

function getNumberShortcutIndex(e: KeyboardEvent): number | null {
  const codeMatch = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  const digit = codeMatch?.[1] ?? (/^\d$/.test(e.key) ? e.key : null);
  if (!digit) return null;

  const itemNumber = digit === "0" ? 10 : Number(digit);
  return itemNumber - 1;
}

function hasQuickCopyModifier(
  e: KeyboardEvent,
  modifier: QuickCopyModifier
): boolean {
  if (e.altKey && modifier !== "alt") return false;
  if (e.shiftKey && modifier !== "shift") return false;

  if (modifier === "alt")
    return e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey;
  if (modifier === "shift")
    return e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;

  return isMacLike() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

export default function App() {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [totalSize, setTotalSize] = useState(0);
  const [quickCopyModifier, setQuickCopyModifier] =
    useState<QuickCopyModifier>("primary");

  const refreshSize = useCallback(async () => {
    const size = await window.clipboardAPI.getTotalSize();
    setTotalSize(size);
  }, []);

  const loadItems = useCallback(async () => {
    const data = query.trim()
      ? await window.clipboardAPI.searchItems(query.trim())
      : await window.clipboardAPI.getItems();
    setItems(data);
  }, [query]);

  const loadSettings = useCallback(() => {
    void window.clipboardAPI.getSettings().then((settings) => {
      setQuickCopyModifier(settings.quickCopyModifier);
    });
  }, []);

  // 초기 로드 + 검색어 변경 시마다 다시 로드.
  useEffect(() => {
    loadItems();
    refreshSize();
  }, [loadItems, refreshSize]);

  useEffect(() => {
    loadSettings();
    window.addEventListener("focus", loadSettings);
    return () => window.removeEventListener("focus", loadSettings);
  }, [loadSettings]);

  // 메인 프로세스에서 push하는 실시간 갱신.
  useEffect(() => {
    window.clipboardAPI.onNewItem(() => {
      // 현재 쿼리/필터를 다시 실행해 새 항목이 올바르게 반영되게 한다.
      loadItems();
      refreshSize();
    });
    // 트레이 "전체 삭제"로 저장소 비움 — 빈 목록으로 갱신.
    window.clipboardAPI.onCleared(() => {
      loadItems();
      refreshSize();
    });
    return () => {
      window.clipboardAPI.removeNewItemListener();
      window.clipboardAPI.removeClearedListener();
    };
  }, [loadItems, refreshSize]);

  const handleCopy = useCallback(async (item: ClipboardItem) => {
    await window.clipboardAPI.copyToClipboard(item.content);
    await window.clipboardAPI.hideWindow();
  }, []);

  const handleDelete = useCallback(
    async (id: number) => {
      await window.clipboardAPI.deleteItem(id);
      await loadItems();
      await refreshSize();
    },
    [loadItems, refreshSize]
  );

  const handleClose = useCallback(() => {
    window.clipboardAPI.hideWindow();
  }, []);

  const handleSettings = useCallback(() => {
    window.clipboardAPI.openSettings();
  }, []);

  // 활성 탭으로 로드된 항목 필터.
  const visibleItems = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((item) => item.type === tab);
  }, [items, tab]);

  // Escape로 닫고, 기본 설정 단축키로 설정 창을 연다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void window.clipboardAPI.hideWindow();
        return;
      }

      const hasPrimaryModifier = isMacLike()
        ? e.metaKey && !e.ctrlKey
        : e.ctrlKey && !e.metaKey;

      if (hasPrimaryModifier && !e.altKey && !e.shiftKey && e.code === "Comma") {
        e.preventDefault();
        e.stopPropagation();
        void window.clipboardAPI.openSettings();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 설정된 보조키 + 숫자로 보이는 순서의 항목을 바로 복사한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasQuickCopyModifier(e, quickCopyModifier)) return;

      const index = getNumberShortcutIndex(e);
      if (index === null) return;

      const item = visibleItems[index];
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();
      void handleCopy(item);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCopy, quickCopyModifier, visibleItems]);

  return (
    <div
      className={[
        "flex h-full flex-col overflow-hidden bg-white text-gray-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-ink dark:text-gray-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        // macOS(투명 창)는 CSS 로 둥글린다. Windows(불투명 창)는
        // OS 라운딩에 맡겨 모서리가 이중으로 보이지 않게 한다.
        isMacLike() ? "rounded-[20px]" : "rounded-none",
      ].join(" ")}
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
      <StorageBar usedBytes={totalSize} />
      <div className="h-px bg-gray-100 dark:bg-white/[0.08]" />
      <HistoryList
        items={visibleItems}
        quickCopyModifier={quickCopyModifier}
        onCopy={handleCopy}
        onDelete={handleDelete}
      />
    </div>
  );
}
