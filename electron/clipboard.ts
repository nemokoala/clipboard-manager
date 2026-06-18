import { clipboard, nativeImage } from 'electron'
import { insertItem } from './db'
import type { ClipboardItem, ClipboardType } from '../src/types'

const POLL_INTERVAL = 500 // 밀리초

let timer: NodeJS.Timeout | null = null

// 매 tick마다 중복 저장하지 않도록 마지막 클립보드 상태를 추적한다.
let lastText = ''
let lastImageHash = ''

/** 텍스트가 속할 분류를 결정한다. */
function classifyText(text: string): ClipboardType {
  const trimmed = text.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return 'link'
  }
  return 'text'
}

/**
 * 시스템 클립보드를 폴링한다. 내용이 바뀔 때마다 저장하고
 * `onNewItem`을 호출해 UI가 실시간으로 갱신되게 한다.
 */
export function startClipboardWatcher(onNewItem: (item: ClipboardItem) => void): void {
  if (timer) return

  // 첫 tick에서 즉시 재캡처하지 않도록 현재 클립보드로 baseline을 설정한다.
  lastText = clipboard.readText()
  const seedImage = clipboard.readImage()
  lastImageHash = seedImage.isEmpty() ? '' : seedImage.toPNG().toString('base64')

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
    const pngBase64 = image.toPNG().toString('base64')
    if (pngBase64 && pngBase64 !== lastImageHash) {
      lastImageHash = pngBase64
      // 같은 복사가 이중 집계되지 않도록 텍스트 baseline을 동기화한다.
      lastText = clipboard.readText()

      const content = `data:image/png;base64,${pngBase64}`
      const item = insertItem('image', content)
      onNewItem(item)
    }
    return
  }

  // 이미지 없음 — 이미지 baseline 초기화.
  lastImageHash = ''

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
 */
export function writeToClipboard(content: string): void {
  if (content.startsWith('data:image/')) {
    const img = nativeImage.createFromDataURL(content)
    clipboard.writeImage(img)
    lastImageHash = img.isEmpty() ? '' : img.toPNG().toString('base64')
  } else {
    clipboard.writeText(content)
    lastText = content
  }
}
