import type { TabFilter } from "../types";

interface TabBarProps {
  active: TabFilter;
  onChange: (tab: TabFilter) => void;
}

const TABS: { value: TabFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "text", label: "텍스트" },
  { value: "image", label: "이미지" },
  { value: "link", label: "링크" },
];

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="mx-3 mb-2 mt-2 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={[
              "flex-1 rounded-lg py-1.5 text-xs font-semibold transition",
              isActive
                ? "bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
