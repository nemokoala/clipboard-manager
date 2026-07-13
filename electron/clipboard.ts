import { clipboard, nativeImage, type NativeImage } from 'electron'
import { createHash } from 'node:crypto'
import { classifyText } from './classify'
import { insertItem } from './db'
import { makeThumbnail } from './thumbnail'
import type { ClipboardItem } from '../src/types'

const POLL_INTERVAL = 500 // 밀리초

let timer: NodeJS.Timeout | null = null

// 매 tick마다 중복 저장하지 않도록 마지막 클립보드 상태를 추적한다.
let lastText = ''
let lastImageFingerprint = ''

/**
 * 이미지가 바뀌었는지 판단할 지문.
 *
 * 예전에는 PNG 로 인코딩한 base64 를 그대로 비교했는데 `toPNG()` 가 매우 비싸다
 * (1440x1080 기준 약 200ms). 폴링이 500ms 마다 도니, 클립보드에 이미지가 하나
 * 올라와 있는 것만으로 변경이 없어도 CPU 를 절반 가까이 계속 태우게 된다.
 *
 * 압축하지 않은 원시 비트맵을 해싱하면 같은 판정을 4ms 에 끝낸다
 * (toBitmap 1ms + sha1 3ms). PNG 인코딩은 진짜 새 이미지일 때만 한 번 한다.
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

  timer = setInterval(() => {
    try {
      pollOnce(onNewItem)
    } catch (err) {
      // 일시적 클립보드 읽기 오류로 watcher가 종료되지 않게 한다.
      console.error('[clipboard] poll error:', err)
    }
  }, POLL_INTERVAL)
}

function pollOnce(onNewItem: (item: ClipboardItem) => void): void {
  // 1. 이미지 우선: 복사한 이미지는 텍스트 fallback도 노출하는 경우가 많아
  //    이미지 채널을 먼저 확인해 올바르게 분류한다.
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const fingerprint = imageFingerprint(image)
    if (fingerprint !== lastImageFingerprint) {
      lastImageFingerprint = fingerprint
      // 같은 복사가 이중 집계되지 않도록 텍스트 baseline을 동기화한다.
      lastText = clipboard.readText()

      // 여기서 처음으로 PNG 인코딩을 한다 — 진짜 새 이미지일 때만.
      const content = `data:image/png;base64,${image.toPNG().toString('base64')}`
      // 목록용 축소본도 지금 만든다. `image` 는 이미 디코딩된 비트맵이라 여기가 가장 싸다.
      const item = insertItem(
        'image',
        content,
        makeThumbnail(image) ?? undefined,
      )
      onNewItem(item)
    }
    return
  }

  // 이미지 없음 — 이미지 baseline 초기화.
  lastImageFingerprint = ''

  // 2. 텍스트/링크 처리.
  const text = clipboard.readText()
  if (text && text !== lastText) {
    lastText = text
    const type = classifyText(text)
    const item = insertItem(type, text)
    onNewItem(item)
  }
}

/** 폴링 루프 중지 (앱 종료 시 호출). */
export function stopClipboardWatcher(): void {
  if (timer) {
    clearInterval(timer)
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
}
