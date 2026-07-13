import { purgeOldItems } from './db'
import { getMaxItems, getRetentionDays } from './settings'

/**
 * 현재 보관 정책(보관 기간 / 최대 개수)으로 오래·초과 항목을 정리한다.
 * 무언가 지워졌으면 true — 호출자가 UI 갱신이 필요한지 판단한다.
 */
export function runPurge(): boolean {
  return purgeOldItems(getRetentionDays(), getMaxItems()) > 0
}
