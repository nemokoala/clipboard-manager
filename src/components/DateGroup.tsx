interface DateGroupHeaderProps {
  label: string
  /** 날짜 그룹 단위 선택. "고정됨" 그룹에는 주지 않는다(고정 항목은 묶어서 지우지 않음). */
  selection?: {
    /** 그룹의 모든 항목이 선택됐는지 — 버튼 문구가 "선택 해제" 로 바뀐다. */
    allSelected: boolean
    /** 선택 모드 중이면 hover 없이도 버튼을 보여준다. */
    alwaysVisible: boolean
    onToggle: () => void
  }
}

/**
 * 날짜 그룹("오늘", "어제", "고정됨" …)의 제목 행.
 * 가상 스크롤에서는 헤더와 카드가 각각 독립된 행이라 카드를 감싸지 않고 제목만 그린다.
 * 버튼은 제목과 같은 줄높이라 헤더 높이(30.5px)가 바뀌지 않는다.
 */
export default function DateGroupHeader({
  label,
  selection,
}: DateGroupHeaderProps) {
  return (
    <h2 className="group/header flex items-center justify-between px-4 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
      <span>{label}</span>
      {selection && (
        <button
          type="button"
          onClick={selection.onToggle}
          className={[
            'font-medium normal-case tracking-normal text-toss-blue transition hover:underline focus-visible:opacity-100',
            selection.alwaysVisible
              ? 'opacity-100'
              : 'opacity-0 group-hover/header:opacity-100',
          ].join(' ')}
        >
          {selection.allSelected ? '선택 해제' : '이 날짜 선택'}
        </button>
      )}
    </h2>
  )
}
