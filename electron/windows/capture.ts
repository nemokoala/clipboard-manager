import {
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  nativeImage,
  screen,
  type Display,
  type NativeImage,
} from 'electron'
import { writeFile } from 'node:fs/promises'
import type { CaptureRect } from '../../src/types'
import { getWindowRectAtPoint } from '../window-bounds'
import {
  WEB_PREFERENCES,
  keepVisibleOnMacFullscreen,
  loadRoute,
} from './shared'
import { hideOverlay } from './overlay'
import { showToast } from './toast'

interface CaptureScreen {
  display: Display
  image: NativeImage
}

const windows = new Map<string, BrowserWindow>()
const captures = new Map<string, CaptureScreen>()
let starting = false
let previewWindow: BrowserWindow | null = null
let previewImage: NativeImage | null = null

export async function startCapture(): Promise<void> {
  if (starting || windows.size > 0) return
  starting = true
  hideOverlay()
  closeCapturePreview()

  try {
    // 기존 창이 완전히 사라진 다음 화면을 읽어 앱 자체가 캡처되지 않게 한다.
    await new Promise((resolve) => setTimeout(resolve, 120))
    const displays = screen.getAllDisplays()
    const maxWidth = Math.max(
      ...displays.map((display) =>
        Math.round(display.bounds.width * display.scaleFactor),
      ),
    )
    const maxHeight = Math.max(
      ...displays.map((display) =>
        Math.round(display.bounds.height * display.scaleFactor),
      ),
    )
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: maxWidth, height: maxHeight },
    })

    for (const display of displays) {
      const source =
        sources.find((item) => item.display_id === String(display.id)) ??
        (displays.length === 1 ? sources[0] : undefined)
      if (!source || source.thumbnail.isEmpty()) continue

      const displayId = String(display.id)
      captures.set(displayId, { display, image: source.thumbnail })
      createCaptureWindow(displayId, display, source.thumbnail)
    }

    if (windows.size === 0) {
      showToast('화면을 캡처할 수 없습니다.')
    }
  } catch (error) {
    console.error('[capture] 캡처 시작 실패:', error)
    closeCaptureWindows()
    showToast('화면 캡처를 시작하지 못했습니다.')
  } finally {
    starting = false
  }
}

function createCaptureWindow(
  displayId: string,
  display: Display,
  image: NativeImage,
): void {
  const win = new BrowserWindow({
    ...display.bounds,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: WEB_PREFERENCES,
  })
  keepVisibleOnMacFullscreen(win)
  windows.set(displayId, win)
  loadRoute(win, `capture?display=${displayId}`)

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('capture:ready', {
      displayId,
      width: display.bounds.width,
      height: display.bounds.height,
      screenshot: image.toDataURL(),
    })
    setTimeout(() => {
      if (win.isDestroyed()) return
      win.show()
      if (
        screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id ===
        display.id
      ) {
        win.focus()
      }
    }, 40)
  })

  win.on('closed', () => {
    windows.delete(displayId)
  })
}

export function getCaptureRegion(
  displayId: string,
  localX: number,
  localY: number,
): CaptureRect {
  const capture = captures.get(displayId)
  if (!capture) return { x: 0, y: 0, width: 0, height: 0 }
  const { bounds } = capture.display
  const screenPoint =
    process.platform === 'win32'
      ? screen.dipToScreenPoint({
          x: Math.round(bounds.x + localX),
          y: Math.round(bounds.y + localY),
        })
      : { x: Math.round(bounds.x + localX), y: Math.round(bounds.y + localY) }
  const nativeRect = getWindowRectAtPoint(screenPoint.x, screenPoint.y)

  if (!nativeRect) {
    return { x: 0, y: 0, width: bounds.width, height: bounds.height }
  }

  const dipRect =
    process.platform === 'win32'
      ? screen.screenToDipRect(null, nativeRect)
      : nativeRect
  const x = dipRect.x - bounds.x
  const y = dipRect.y - bounds.y
  return clampRect(
    {
      x,
      y,
      width: dipRect.width,
      height: dipRect.height,
    },
    bounds.width,
    bounds.height,
  )
}

export function completeCapture(
  displayId: string,
  rect: CaptureRect,
  quickCopy = false,
): void {
  const capture = captures.get(displayId)
  if (!capture) return
  const safe = clampRect(
    rect,
    capture.display.bounds.width,
    capture.display.bounds.height,
  )
  if (safe.width < 2 || safe.height < 2) return

  const imageSize = capture.image.getSize()
  const scaleX = imageSize.width / capture.display.bounds.width
  const scaleY = imageSize.height / capture.display.bounds.height
  const cropped = capture.image.crop({
    x: Math.max(0, Math.round(safe.x * scaleX)),
    y: Math.max(0, Math.round(safe.y * scaleY)),
    width: Math.max(1, Math.round(safe.width * scaleX)),
    height: Math.max(1, Math.round(safe.height * scaleY)),
  })

  closeCaptureWindows()
  // 감시기가 이 변경을 기존 이미지 히스토리 흐름으로 저장하고 토스트를 표시한다.
  const result = nativeImage.createFromBuffer(cropped.toPNG())
  clipboard.writeImage(result)
  if (!quickCopy) showCapturePreview(result)
}

export function cancelCapture(): void {
  closeCaptureWindows()
}

function showCapturePreview(image: NativeImage): void {
  closeCapturePreview()
  previewImage = image
  const { width, height } = image.getSize()
  const win = new BrowserWindow({
    width: 820,
    height: 620,
    minWidth: 520,
    minHeight: 420,
    frame: false,
    roundedCorners: true,
    hasShadow: true,
    backgroundColor: '#15171A',
    alwaysOnTop: true,
    show: false,
    webPreferences: WEB_PREFERENCES,
  })
  previewWindow = win
  keepVisibleOnMacFullscreen(win)
  loadRoute(win, 'capture-preview')

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('capture:preview', {
      dataUrl: image.toDataURL(),
      width,
      height,
    })
    win.show()
    win.focus()
  })

  win.on('closed', () => {
    if (previewWindow === win) {
      previewWindow = null
      previewImage = null
    }
  })
}

export function copyCapturePreview(): boolean {
  if (!previewImage || previewImage.isEmpty()) return false
  clipboard.writeImage(previewImage)
  showToast('캡처 이미지를 클립보드에 복사했습니다.')
  return true
}

export async function saveCapturePreview(): Promise<boolean> {
  if (!previewImage || previewImage.isEmpty()) return false
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const options = {
    title: '캡처 이미지 저장',
    defaultPath: `capture-${stamp}.png`,
    filters: [{ name: 'PNG 이미지', extensions: ['png'] }],
  }
  const result = previewWindow
    ? await dialog.showSaveDialog(previewWindow, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return false
  try {
    await writeFile(result.filePath, previewImage.toPNG())
    showToast('캡처 이미지를 저장했습니다.')
    return true
  } catch (error) {
    console.error('[capture] PNG 저장 실패:', error)
    showToast('캡처 이미지를 저장하지 못했습니다.')
    return false
  }
}

export function closeCapturePreview(): void {
  const win = previewWindow
  previewWindow = null
  previewImage = null
  if (win && !win.isDestroyed()) win.destroy()
}

function closeCaptureWindows(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy()
  }
  windows.clear()
  captures.clear()
}

function clampRect(
  rect: CaptureRect,
  maxWidth: number,
  maxHeight: number,
): CaptureRect {
  const x = Math.max(0, Math.min(maxWidth, Math.round(rect.x)))
  const y = Math.max(0, Math.min(maxHeight, Math.round(rect.y)))
  return {
    x,
    y,
    width: Math.max(0, Math.min(maxWidth - x, Math.round(rect.width))),
    height: Math.max(0, Math.min(maxHeight - y, Math.round(rect.height))),
  }
}
