import { broadcastRefresh } from './broadcast'
import { getImagesMissingThumbnail, setThumbnail } from './db'
import { makeThumbnailFromDataUrl } from './thumbnail'

/** 한 배치에서 처리할 이미지 수. 메인 프로세스를 오래 붙잡지 않도록 작게 둔다. */
const BATCH_SIZE = 5
/** 배치 사이에 이벤트 루프를 비워 준다. */
const BATCH_DELAY_MS = 50

let running = false

/**
 * 썸네일 도입 이전에 저장된 이미지의 썸네일을 채운다.
 *
 * 시작할 때 한 번에 처리하면 저장된 이미지를 전부 디코딩하느라 앱이 수 초간 멈춘다
 * (수십 MB 규모가 흔하다). 그래서 작은 배치로 나눠 이벤트 루프를 양보하며 돌린다.
 * 백필 전까지는 DB 조회가 원본으로 폴백하므로(`COALESCE(thumbnail, content)`)
 * 화면은 그동안에도 정상 동작한다 — 느릴 뿐이다.
 *
 * 다 끝나면 목록을 다시 읽게 해 썸네일이 실제로 적용되게 한다.
 */
export function backfillThumbnails(): void {
  if (running) return
  running = true

  let filled = 0

  const step = (): void => {
    const pending = getImagesMissingThumbnail(BATCH_SIZE)

    if (pending.length === 0) {
      running = false
      if (filled > 0) {
        console.log(`[thumbnail] 기존 이미지 ${filled}개의 썸네일을 생성했다.`)
        broadcastRefresh()
      }
      return
    }

    for (const { id, content } of pending) {
      // 디코딩에 실패하면 원본을 그대로 넣어 둔다. 화면은 정상이고(느릴 뿐),
      // thumbnail 이 NULL 이 아니게 되므로 이 항목을 무한히 다시 잡지 않는다.
      setThumbnail(id, makeThumbnailFromDataUrl(content) ?? content)
      filled += 1
    }

    setTimeout(step, BATCH_DELAY_MS)
  }

  setTimeout(step, BATCH_DELAY_MS)
}
