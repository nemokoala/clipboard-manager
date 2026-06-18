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
    <div className="flex gap-1 px-3 pb-2 mt-2">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={[
              "flex-1 rounded-lg py-1.5 text-xs font-medium transition",
              isActive
                ? "bg-white/15 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white/80",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
