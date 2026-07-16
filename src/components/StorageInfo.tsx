import type { StorageStats } from '../types'
import { formatBytes } from '../utils/format'

interface StorageInfoProps {
  /** DB 전체 기준 현황(검색어/탭 필터의 영향을 받지 않는다). */
  stats: StorageStats
}

/**
 * 저장소 현황 표시줄.
 * 앱에는 용량 상한이 없고 자동 정리는 개수/기간 기준이므로, 임의의 한도를 정해
 * 퍼센트 게이지를 그리지 않고 실제 사용량만 그대로 보여준다.
 */
export default function StorageInfo({ stats }: StorageInfoProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400">
      <span>📦 저장된 항목 {stats.itemCount.toLocaleString()}개</span>
      <span className="tabular-nums">{formatBytes(stats.totalBytes)}</span>
    </div>
  )
}
