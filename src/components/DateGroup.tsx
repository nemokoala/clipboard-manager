interface DateGroupHeaderProps {
  label: string
}

/**
 * 날짜 그룹("오늘", "어제", "고정됨" …)의 제목 행.
 * 가상 스크롤에서는 헤더와 카드가 각각 독립된 행이라 카드를 감싸지 않고 제목만 그린다.
 */
export default function DateGroupHeader({ label }: DateGroupHeaderProps) {
  return (
    <h2 className="px-4 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
      {label}
    </h2>
  )
}
