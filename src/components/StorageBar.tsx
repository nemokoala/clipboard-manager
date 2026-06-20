import { formatMB } from '../utils/format'

interface StorageBarProps {
  /** 현재 사용량(바이트). */
  usedBytes: number
  /** 용량(바이트, 기본 50MB). */
  maxBytes?: number
}

const DEFAULT_MAX = 50 * 1024 * 1024 // 50MB 기본값

export default function StorageBar({ usedBytes, maxBytes = DEFAULT_MAX }: StorageBarProps) {
  const ratio = Math.min(usedBytes / maxBytes, 1)
  const pct = ratio * 100

  let barColor = 'bg-toss-blue'
  if (ratio >= 0.95) barColor = 'bg-red-500'
  else if (ratio >= 0.8) barColor = 'bg-amber-400'

  return (
    <div className="px-4 py-2">
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>📦 사용 중: {formatMB(usedBytes)} / {formatMB(maxBytes)}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
