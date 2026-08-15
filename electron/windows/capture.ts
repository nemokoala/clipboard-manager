import {
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  nativeImage,
  screen,
  type DesktopCapturerSource,
  type Display,
  type NativeImage,
} from 'electron'
import { writeFile } from 'node:fs/promises'
import type { CaptureDisplayData, CaptureRect } from '../../src/types'
import { getVisibleWindowRects, type NativeWindowRect } from '../window-bounds'
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
  /** 전체 화면 PNG 인코딩은 비싸므로 한 번만 만들어 재사용한다. */
  dataUrl?: string
}

const windows = new Map<string, BrowserWindow>()
const captures = new Map<string, CaptureScreen>()
let starting = false
let captureActive = false
let previewWindow: BrowserWindow | null = null
let previewImage: NativeImage | null = null
let windowRects: NativeWindowRect[] = []
let captureKeysRegistered = false

export async function startCapture(): Promise<void> {
  if (starting || captureActive) return
  starting = true
  captureActive = true
  hideOverlay()
  closeCapturePreview()

  try {
    // 기존 창이 완전히 사라진 다음 화면을 읽어 앱 자체가 캡처되지 않게 한다.
    await new Promise((resolve) => setTimeout(resolve, 35))
    // 오버레이가 Z-order를 가리기 전에 자동 선택 후보를 고정한다.
    windowRects = getVisibleWindowRects()
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

    const sourceByDisplay = matchSourcesToDisplays(displays, sources)
    for (const display of displays) {
      const source = sourceByDisplay.get(String(display.id))
      if (!source || source.thumbnail.isEmpty()) continue

      const displayId = String(display.id)
      const image = trimToPhysicalSize(source.thumbnail, display)
      captures.set(displayId, { display, image })
      showCaptureWindow(displayId, display, image)
    }

    console.info(
      `[capture] 캡처 시작: 디스플레이 ${displays.length}개 / 소스 ${sources.length}개 / 오버레이 ${captures.size}개`,
    )

    if (captures.size === 0) {
      closeCaptureWindows('unavailable')
      showToast('화면을 캡처할 수 없습니다.')
      return
    }
    registerCaptureKeys()
  } catch (error) {
    console.error('[capture] 캡처 시작 실패:', error)
    closeCaptureWindows('start-error')
    showToast('화면 캡처를 시작하지 못했습니다.')
  } finally {
    starting = false
  }
}

/**
 * 소스와 디스플레이를 짝짓는다.
 * 우선 `display_id` 로 맞추고, 그 값이 비어 있는 환경(Windows 일부 드라이버)에서는
 * 남은 것끼리 순서대로 짝짓는다. 예전처럼 모니터가 2개 이상일 때 그냥 건너뛰면
 * 그 모니터에는 캡처 오버레이가 아예 뜨지 않는다.
 */
function matchSourcesToDisplays(
  displays: Display[],
  sources: DesktopCapturerSource[],
): Map<string, DesktopCapturerSource> {
  const matched = new Map<string, DesktopCapturerSource>()
  const used = new Set<string>()

  for (const display of displays) {
    const source = sources.find(
      (item) => item.display_id === String(display.id) && !used.has(item.id),
    )
    if (!source) continue
    matched.set(String(display.id), source)
    used.add(source.id)
  }

  const leftovers = sources.filter((item) => !used.has(item.id))
  for (const display of displays) {
    if (matched.has(String(display.id))) continue
    const source = leftovers.shift()
    if (source) matched.set(String(display.id), source)
  }

  return matched
}

function showCaptureWindow(
  displayId: string,
  display: Display,
  image: NativeImage,
): void {
  const existing = windows.get(displayId)
  if (existing && !existing.isDestroyed()) {
    sendCaptureToWindow(existing, displayId, display, image)
    return
  }

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
    // 모니터마다 창이 하나씩 있으므로 활성화(포커스)를 쓰면 반드시 깨진다.
    //  - 어느 한 창만 키 입력을 받아, 다른 모니터에서는 Esc/Enter 가 죽는다.
    //  - 비활성 창의 첫 클릭은 창 활성화에 먹힌다.
    //  - 커서를 따라 포커스를 옮기면 이동 내내 전면 창이 바뀌며 오버레이가 흔들린다.
    // 창을 아예 활성화 대상에서 빼면(WS_EX_NOACTIVATE) 세 문제가 같이 사라진다.
    // 마우스 입력은 그대로 들어오고, 키보드는 메인이 전역 단축키로 받는다.
    focusable: false,
    show: false,
    webPreferences: WEB_PREFERENCES,
  })
  keepVisibleOnMacFullscreen(win)
  windows.set(displayId, win)
  loadRoute(win, `capture?display=${displayId}`)

  win.webContents.once('did-finish-load', () => {
    sendCaptureToWindow(win, displayId, display, image)
  })

  // 렌더러가 죽으면 검은 창만 남아 캡처가 멈춘 것처럼 보인다. 전체를 정리한다.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[capture] 캡처 창 렌더러 종료:', displayId, details.reason)
    if (!win.isDestroyed()) win.destroy()
    closeCaptureWindows('renderer-gone')
    showToast('화면 캡처가 중단되었습니다.')
  })

  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[capture] 캡처 창 로드 실패:', displayId, code, description)
    closeCaptureWindows('load-error')
    showToast('화면 캡처를 시작하지 못했습니다.')
  })

  win.on('closed', () => {
    windows.delete(displayId)
    if (![...windows.values()].some((item) => item.isVisible())) {
      captureActive = false
    }
  })
}

function sendCaptureToWindow(
  win: BrowserWindow,
  displayId: string,
  display: Display,
  image: NativeImage,
): void {
  win.setBounds(display.bounds)
  win.webContents.send(
    'capture:ready',
    buildDisplayData(displayId, display, image),
  )
  // show() 는 창을 활성화한다. 모니터마다 창을 띄우면 마지막에 뜬 창이 포커스를
  // 가져가, 커서가 있는 모니터에서는 Esc/Enter 가 먹지 않고 첫 클릭은 창 활성화에
  // 먹혀버린다. 비활성으로 띄운 뒤 커서가 있는 창만 포커스한다.
  win.showInactive()
}

/**
 * `getSources` 의 thumbnailSize 는 모든 소스에 공통으로 적용돼, 가장 큰 모니터에
 * 맞춘 상자 크기로 작은 모니터의 화면까지 확대해서 돌려준다(1920×1080 → 3841×2161).
 * 확대분은 화질에 보탬이 없고 메모리만 4배로 먹으므로 실제 물리 해상도로 되돌린다.
 */
function trimToPhysicalSize(image: NativeImage, display: Display): NativeImage {
  const width = Math.round(display.bounds.width * display.scaleFactor)
  const height = Math.round(display.bounds.height * display.scaleFactor)
  const size = image.getSize()
  if (size.width <= width || size.height <= height) return image
  return image.resize({ width, height, quality: 'good' })
}

function buildDisplayData(
  displayId: string,
  display: Display,
  image: NativeImage,
): CaptureDisplayData {
  const capture = captures.get(displayId)
  const screenshot = capture?.dataUrl ?? encodePreview(image, display)
  if (capture) capture.dataUrl = screenshot
  return {
    displayId,
    width: display.bounds.width,
    height: display.bounds.height,
    screenshot,
  }
}

/**
 * 렌더러에는 물리 해상도 JPEG 를 보낸다.
 * PNG 는 4K 한 장이 1.3~3.5MB · 인코딩 264~412ms 라 모니터마다 만들면 메인이 멎는다.
 * JPEG 는 같은 4K 가 ~1MB · 33~43ms 로 끝나므로 크기를 줄일 이유가 없다.
 *
 * ⚠️ 여기서 DIP 크기로 줄이면 안 된다. 오버레이 창은 devicePixelRatio(=scaleFactor)
 * 만큼 물리 픽셀로 그려지므로, DIP 로 줄인 이미지는 렌더러가 다시 1.5~1.75배 확대해
 * 배경이 눈에 띄게 흐려진다(돋보기는 zoom 2 가 겹쳐 3배 이상 확대). 물리 크기로 보내면
 * CSS 상 1:1 로 맞아 선명하다. 실제 잘라내기는 메인의 원본으로 하는 건 그대로다.
 */
function encodePreview(image: NativeImage, display: Display): string {
  const physicalWidth = Math.round(display.bounds.width * display.scaleFactor)
  const size = image.getSize()
  // 캡처 원본이 이미 물리 해상도이므로 보통은 리사이즈 없이 그대로 인코딩된다.
  const preview =
    size.width > physicalWidth
      ? image.resize({
          width: physicalWidth,
          height: Math.round(display.bounds.height * display.scaleFactor),
          quality: 'good',
        })
      : image
  return `data:image/jpeg;base64,${preview.toJPEG(88).toString('base64')}`
}

/**
 * 렌더러가 마운트 직후 직접 가져가는 경로.
 * 메인의 `capture:ready` push 는 `did-finish-load` 에 실리는데, 이 이벤트가
 * React 가 리스너를 등록하기 전에 오면 그 모니터만 검은 화면으로 남는다.
 * 모니터가 여러 개면 동시에 로드되며 이 경쟁이 훨씬 자주 일어난다.
 */
export function getCaptureState(displayId: string): CaptureDisplayData | null {
  const capture = captures.get(displayId)
  if (!captureActive || !capture) return null
  return buildDisplayData(displayId, capture.display, capture.image)
}

/**
 * 캡처 창은 포커스를 받지 않으므로 키 입력이 렌더러에 닿지 않는다.
 * 캡처가 떠 있는 동안만 Esc/Enter 를 전역 단축키로 잡아 메인이 처리한다.
 * 이러면 어느 모니터를 보고 있든 키가 동작한다.
 */
function registerCaptureKeys(): void {
  if (captureKeysRegistered) return
  try {
    const escapeOk = globalShortcut.register('Escape', () => cancelCapture())
    const enterOk = globalShortcut.register('Return', () =>
      commitCursorDisplay(),
    )
    captureKeysRegistered = true
    if (!escapeOk || !enterOk) {
      console.warn(
        `[capture] 캡처용 키 등록 실패 (Esc: ${escapeOk}, Enter: ${enterOk}) — 창 포커스가 있을 때만 동작한다.`,
      )
    }
  } catch (error) {
    console.warn('[capture] 캡처용 키 등록 실패:', error)
  }
}

function unregisterCaptureKeys(): void {
  if (!captureKeysRegistered) return
  globalShortcut.unregister('Escape')
  globalShortcut.unregister('Return')
  captureKeysRegistered = false
}

/** Enter: 커서가 있는 모니터의 렌더러에게 현재 선택으로 확정하라고 알린다. */
function commitCursorDisplay(): void {
  if (!captureActive) return
  const cursor = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const win =
    windows.get(String(cursor.id)) ??
    [...windows.values()].find((item) => !item.isDestroyed() && item.isVisible())
  if (!win || win.isDestroyed() || !win.isVisible()) return
  win.webContents.send('capture:commit')
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
  const nativeRect =
    windowRects.find(
      (rect) =>
        screenPoint.x >= rect.x &&
        screenPoint.x < rect.x + rect.width &&
        screenPoint.y >= rect.y &&
        screenPoint.y < rect.y + rect.height,
    ) ?? null

  if (!nativeRect) {
    return { x: 0, y: 0, width: bounds.width, height: bounds.height }
  }

  let dipRect: NativeWindowRect
  try {
    dipRect =
      process.platform === 'win32'
        ? screen.screenToDipRect(windows.get(displayId) ?? null, nativeRect)
        : nativeRect
  } catch (error) {
    console.warn('[capture] 창 좌표 변환 실패, 화면 전체로 대체합니다.', error)
    return { x: 0, y: 0, width: bounds.width, height: bounds.height }
  }
  const x = dipRect.x - bounds.x
  const y = dipRect.y - bounds.y
  const region = clampRect(
    {
      x,
      y,
      width: dipRect.width,
      height: dipRect.height,
    },
    bounds.width,
    bounds.height,
  )
  if (region.width < 2 || region.height < 2) {
    console.warn(
      '[capture] 보조 모니터 창 영역 변환이 유효하지 않아 화면 전체로 대체합니다.',
      {
        displayId,
        displayBounds: bounds,
        nativeRect,
        dipRect,
      },
    )
    return { x: 0, y: 0, width: bounds.width, height: bounds.height }
  }
  return region
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

  closeCaptureWindows(quickCopy ? 'quick-copy' : 'complete')
  // 감시기가 이 변경을 기존 이미지 히스토리 흐름으로 저장하고 토스트를 표시한다.
  const result = nativeImage.createFromBuffer(cropped.toPNG())
  clipboard.writeImage(result)
  if (!quickCopy) showCapturePreview(result)
}

export function cancelCapture(): void {
  closeCaptureWindows('cancel')
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

function closeCaptureWindows(reason: string): void {
  console.info(`[capture] 캡처 화면 종료: ${reason}`)
  unregisterCaptureKeys()
  for (const win of windows.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send('capture:closed')
      win.hide()
    }
  }
  captures.clear()
  windowRects = []
  captureActive = false
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
