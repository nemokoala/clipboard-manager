interface SelectionBarProps {
  count: number
  onClear: () => void
  onDelete: () => void
}

/**
 * 다중 선택 중에 저장소 현황 줄(StorageInfo) 자리에 대신 나오는 줄.
 * 같은 패딩·글자 크기라 높이가 같아서, 바뀌어도 아래 목록이 밀리지 않는다.
 * 삭제 버튼에 개수를 적어 무엇을 지우는지 분명히 한다.
 */
export default function SelectionBar({
  count,
  onClear,
  onDelete,
}: SelectionBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400">
      <span className="font-medium text-toss-blue">
        {count.toLocaleString()}개 선택됨
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="transition hover:text-gray-800 dark:hover:text-gray-200"
        >
          선택 해제
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="font-semibold text-red-500 transition hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
        >
          {count.toLocaleString()}개 삭제
        </button>
      </div>
    </div>
  )
}
