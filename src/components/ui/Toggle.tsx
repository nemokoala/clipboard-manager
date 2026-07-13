interface ToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}

/** 설정 화면의 on/off 스위치 행 (제목 + 설명 + 스위치). */
export default function Toggle({
  label,
  description,
  checked,
  onChange,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <span>
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
          {label}
        </span>
        <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
          {description}
        </span>
      </span>

      <span
        className={[
          'ml-4 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition',
          checked ? 'bg-toss-blue' : 'bg-gray-300 dark:bg-white/15',
        ].join(' ')}
      >
        <span
          className={[
            'h-5 w-5 rounded-full bg-white transition',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
    </button>
  )
}
