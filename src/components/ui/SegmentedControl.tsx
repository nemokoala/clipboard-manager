export interface Option<T> {
  value: T
  label: string
}

interface SegmentedControlProps<T> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

/** 하나의 알약 모양 트랙 안에서 선택 항목이 강조되는 세그먼트 컨트롤. */
export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'flex-1 rounded-lg py-2 text-sm font-semibold transition',
              active
                ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
