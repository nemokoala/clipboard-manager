import { clipboard, nativeImage } from 'electron'
import { insertItem } from './db'
import type { ClipboardItem, ClipboardType } from '../src/types'

const POLL_INTERVAL = 500 // ms

let timer: NodeJS.Timeout | null = null

// Track the last seen clipboard state to avoid storing duplicates on every tick.
let lastText = ''
let lastImageHash = ''

/** Decide which bucket a piece of text belongs to. */
function classifyText(text: string): ClipboardType {
  const trimmed = text.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return 'link'
  }
  return 'text'
}

/**
 * Start polling the system clipboard. Whenever the content changes, the new
 * item is persisted and `onNewItem` is invoked so the UI can update live.
 */
export function startClipboardWatcher(onNewItem: (item: ClipboardItem) => void): void {
  if (timer) return

  // Seed the baseline with whatever is currently on the clipboard so we don't
  // immediately re-capture it on the first tick.
  lastText = clipboard.readText()
  const seedImage = clipboard.readImage()
  lastImageHash = seedImage.isEmpty() ? '' : seedImage.toPNG().toString('base64')

  timer = setInterval(() => {
    try {
      pollOnce(onNewItem)
    } catch (err) {
      // Never let a transient clipboard read error kill the watcher.
      console.error('[clipboard] poll error:', err)
    }
  }, POLL_INTERVAL)
}

function pollOnce(onNewItem: (item: ClipboardItem) => void): void {
  // 1. Prefer images: a copied image often also exposes a text fallback, so
  //    we check the image channel first to classify it correctly.
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const pngBase64 = image.toPNG().toString('base64')
    if (pngBase64 && pngBase64 !== lastImageHash) {
      lastImageHash = pngBase64
      // Keep text baseline in sync so the same copy isn't double-counted.
      lastText = clipboard.readText()

      const content = `data:image/png;base64,${pngBase64}`
      const item = insertItem('image', content)
      onNewItem(item)
    }
    return
  }

  // No image present — reset the image baseline.
  lastImageHash = ''

  // 2. Text / link handling.
  const text = clipboard.readText()
  if (text && text !== lastText) {
    lastText = text
    const type = classifyText(text)
    const item = insertItem(type, text)
    onNewItem(item)
  }
}

/** Stop the polling loop (called on app shutdown). */
export function stopClipboardWatcher(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/**
 * Write a stored item's content back to the system clipboard.
 * Handles the base64 image case by reconstructing a nativeImage.
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
