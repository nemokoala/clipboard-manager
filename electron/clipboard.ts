import { clipboard, nativeImage, type NativeImage } from 'electron'
import { createHash } from 'node:crypto'
import { classifyText } from './classify'
import { createClipboardCounter } from './clipboard-counter'
import { insertItem } from './db'
import { makeThumbnail } from './thumbnail'
import type { ClipboardItem } from '../src/types'

// 적응형 폴링 간격.
// 활발할 때는 촘촘히(ACTIVE) 보다가, 변화 없이 조용한 시간이 이어지면 간격을
// 늘려(IDLE) 유휴 CPU 를 줄인다. macOS 에는 클립보드 변경 push 알림이 없어
// 폴링이 불가피한데(네이티브 앱들도 changeCount 를 폴링한다), 최소한 아무도
// 복사하지 않는 동안은 덜 깨어나게 한다.
const ACTIVE_INTERVAL = 500 // 밀리초
// 유휴 간격을 ACTIVE 의 2배로만 둔다. 폴링은 한 간격 안에 두 번 복사하면 앞의 것을
// 놓치는데, 500ms 는 이미 감내하던 값이므로 그 2배로 유실 창을 묶어 둔다.
const IDLE_INTERVAL = 1000 // 밀리초
// 변화 없이 이만큼(회) 지나야 유휴로 전환한다. ACTIVE 로 약 3초의 유예를 둬,
// 연속으로 복사하는 동안에는 반응 속도가 떨어지지 않게 한다.
const IDLE_AFTER_TICKS = 6

let timer: NodeJS.Timeout | null = null
// 변화 없이 지난 연속 tick 수. 임계치를 넘으면 폴링 간격을 늘린다.
let idleTicks = 0

// 매 tick마다 중복 저장하지 않도록 마지막 클립보드 상태를 추적한다.
let lastText = ''
let lastImageFingerprint = ''

// OS 클립보드 변경 카운터(가능한 플랫폼에서만). 있으면 매 tick 정수 비교만으로
// "안 바뀜"을 판정해 이미지/텍스트 읽기를 통째로 건너뛴다. null 이면 지문 비교로 동작.
let readCounter: (() => number) | null = null
let lastCounter = 0

/**
 * 이미지가 바뀌었는지 판단할 지문.
 *
 * 예전에는 PNG 로 인코딩한 base64 를 그대로 비교했는데 `toPNG()` 가 매우 비싸다
 * (1440x1080 기준 약 200ms). 폴링이 500ms 마다 도니, 클립보드에 이미지가 하나
 * 올라와 있는 것만으로 변경이 없어도 CPU 를 절반 가까이 계속 태우게 된다.
 *
 * 압축하지 않은 원시 비트맵을 해싱하면 같은 판정을 4ms 에 끝낸다
 * (toBitmap 1ms + sha1 3ms). PNG 인코딩은 진짜 새 이미지일 때만 한 번 한다.
 * 변경 카운터를 쓸 수 있는 플랫폼에서는 클립보드가 실제로 바뀐 tick 에만
 * 여기까지 오므로 이 비용도 복사가 일어난 순간에만 든다.
 */
function imageFingerprint(image: NativeImage): string {
  const { width, height } = image.getSize()
  const hash = createHash('sha1').update(image.toBitmap()).digest('base64')
  return `${width}x${height}:${hash}`
}

/**
 * 시스템 클립보드를 폴링한다. 내용이 바뀔 때마다 저장하고
 * `onNewItem`을 호출해 UI가 실시간으로 갱신되게 한다.
 */
export function startClipboardWatcher(
  onNewItem: (item: ClipboardItem) => void,
): void {
  if (timer) return

  // 첫 tick에서 즉시 재캡처하지 않도록 현재 클립보드로 baseline을 설정한다.
  lastText = clipboard.readText()
  const seedImage = clipboard.readImage()
  lastImageFingerprint = seedImage.isEmpty() ? '' : imageFingerprint(seedImage)
  readCounter = createClipboardCounter()
  lastCounter = readCounter ? readCounter() : 0
  idleTicks = 0

  scheduleNext(onNewItem)
}

/** 유휴 정도에 따라 다음 tick 을 예약한다(자기-스케줄링 루프). */
function scheduleNext(onNewItem: (item: ClipboardItem) => void): void {
  const interval =
    idleTicks >= IDLE_AFTER_TICKS ? IDLE_INTERVAL : ACTIVE_INTERVAL
  timer = setTimeout(() => {
    try {
      const changed = pollOnce(onNewItem)
      // 변화가 있으면 즉시 촘촘한 폴링으로 복귀하고, 없으면 유휴 카운트를 올린다.
      idleTicks = changed ? 0 : idleTicks + 1
    } catch (err) {
      // 일시적 클립보드 읽기 오류로 watcher가 종료되지 않게 한다.
      console.error('[clipboard] poll error:', err)
    }
    scheduleNext(onNewItem)
  }, interval)
}

/** 새 항목을 캡처했으면 true. 스케줄러가 폴링 간격을 조절하는 데 쓴다. */
function pollOnce(onNewItem: (item: ClipboardItem) => void): boolean {
  // 0. 변경 카운터 게이트: 카운터가 그대로면 클립보드가 안 바뀐 것이므로
  //    아무것도 읽지 않고 끝낸다. 큰 이미지가 올라와 있어도 tick 비용이 정수
  //    비교 한 번이라 유휴 CPU 가 사실상 0 이다.
  if (readCounter) {
    const counter = readCounter()
    if (counter === lastCounter) return false
    lastCounter = counter
  }

  // 1. 이미지 우선: 복사한 이미지는 텍스트 fallback도 노출하는 경우가 많아
  //    이미지 채널을 먼저 확인해 올바르게 분류한다.
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const fingerprint = imageFingerprint(image)
    if (fingerprint === lastImageFingerprint) return false

    lastImageFingerprint = fingerprint
    // 같은 복사가 이중 집계되지 않도록 텍스트 baseline을 동기화한다.
    lastText = clipboard.readText()

    // 여기서 처음으로 PNG 인코딩을 한다 — 진짜 새 이미지일 때만.
    const content = `data:image/png;base64,${image.toPNG().toString('base64')}`
    // 목록용 축소본도 지금 만든다. `image` 는 이미 디코딩된 비트맵이라 여기가 가장 싸다.
    const item = insertItem('image', content, makeThumbnail(image) ?? undefined)
    onNewItem(item)
    return true
  }

  // 이미지 없음 — 이미지 baseline 초기화.
  lastImageFingerprint = ''

  // 2. 텍스트/링크 처리.
  const text = clipboard.readText()
  if (text && text !== lastText) {
    lastText = text
    const item = insertItem(classifyText(text), text)
    onNewItem(item)
    return true
  }

  return false
}

/** 폴링 루프 중지 (앱 종료 시 호출). */
export function stopClipboardWatcher(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

/**
 * 저장된 항목 내용을 시스템 클립보드에 다시 쓴다.
 * base64 이미지는 nativeImage를 재구성해 처리한다.
 *
 * 방금 쓴 내용을 폴링이 "새 항목"으로 오해해 다시 저장하지 않도록 baseline 도 갱신한다.
 */
export function writeToClipboard(content: string): void {
  if (content.startsWith('data:image/')) {
    const image = nativeImage.createFromDataURL(content)
    clipboard.writeImage(image)
    lastImageFingerprint = image.isEmpty() ? '' : imageFingerprint(image)
  } else {
    clipboard.writeText(content)
    lastText = content
  }
  // 방금의 쓰기로 올라간 카운터를 baseline 에 반영해, 다음 tick 이 우리 자신의
  // 쓰기를 변경으로 오해해 클립보드를 다시 읽지 않게 한다.
  if (readCounter) lastCounter = readCounter()
  // 사용자가 방금 무언가를 복사했다 — 활동 중이므로 촘촘한 폴링으로 되돌린다.
  idleTicks = 0
}
