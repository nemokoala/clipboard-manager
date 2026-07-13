import type { Option } from './SegmentedControl'

// Tailwind 는 클래스 문자열을 정적으로 훑기 때문에 `grid-cols-${n}` 처럼
// 조립한 클래스는 빌드에서 누락된다. 쓰는 열 수만 명시적으로 매핑해 둔다.
const COLUMN_CLASS = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
} as const

interface OptionGridProps<T> {
  options: Option<T>[]
  value: T
  columns: keyof typeof COLUMN_CLASS
  onChange: (value: T) => void
}

/** 테두리가 있는 버튼들이 격자로 놓인 단일 선택 그룹. */
export default function OptionGrid<T extends string | number>({
  options,
  value,
  columns,
  onChange,
}: OptionGridProps<T>) {
  return (
    <div className={`grid gap-2 ${COLUMN_CLASS[columns]}`}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'rounded-lg border px-2 py-2 text-sm font-semibold transition',
              active
                ? 'border-toss-blue/60 bg-toss-blue/10 text-toss-blue'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
