import koffi from 'koffi'

export interface NativeWindowRect {
  x: number
  y: number
  width: number
  height: number
}

type WindowFinder = (x: number, y: number) => NativeWindowRect | null

let finder: WindowFinder | null | undefined

/** Windows의 실제 Z-order를 따라 커서 아래 최상위 앱 창의 경계를 찾는다. */
export function getWindowRectAtPoint(
  x: number,
  y: number,
): NativeWindowRect | null {
  if (finder === undefined) finder = createWindowFinder()
  return finder?.(x, y) ?? null
}

function createWindowFinder(): WindowFinder | null {
  if (process.platform !== 'win32') return null

  try {
    const user32 = koffi.load('user32.dll')
    const dwmapi = koffi.load('dwmapi.dll')
    koffi.struct('CaptureRect', {
      left: 'long',
      top: 'long',
      right: 'long',
      bottom: 'long',
    })
    const getTopWindow = user32.func('void* GetTopWindow(void*)')
    const getWindow = user32.func('void* GetWindow(void*, uint32_t)')
    const isWindowVisible = user32.func('bool IsWindowVisible(void*)')
    const getWindowRect = user32.func(
      'bool GetWindowRect(void*, _Out_ CaptureRect*)',
    )
    const getWindowProcess = user32.func(
      'uint32_t GetWindowThreadProcessId(void*, _Out_ uint32_t*)',
    )
    const getCloaked = dwmapi.func(
      'long DwmGetWindowAttribute(void*, uint32_t, _Out_ uint32_t*, uint32_t)',
    )
    const getFrameBounds = dwmapi.func(
      'long DwmGetWindowAttribute(void*, uint32_t, _Out_ CaptureRect*, uint32_t)',
    )

    return (x, y) => {
      let hwnd = getTopWindow(null)
      let inspected = 0

      while (hwnd && inspected < 512) {
        inspected += 1
        const processId = [0]
        getWindowProcess(hwnd, processId)

        if (processId[0] !== process.pid && isWindowVisible(hwnd)) {
          const cloaked = [0]
          const cloakResult = getCloaked(hwnd, 14, cloaked, 4)
          if (cloakResult !== 0 || cloaked[0] === 0) {
            const rect = { left: 0, top: 0, right: 0, bottom: 0 }
            const frameResult = getFrameBounds(hwnd, 9, rect, 16)
            const hasRect = frameResult === 0 || getWindowRect(hwnd, rect)
            const width = rect.right - rect.left
            const height = rect.bottom - rect.top

            if (
              hasRect &&
              width >= 40 &&
              height >= 40 &&
              x >= rect.left &&
              x < rect.right &&
              y >= rect.top &&
              y < rect.bottom
            ) {
              return { x: rect.left, y: rect.top, width, height }
            }
          }
        }

        hwnd = getWindow(hwnd, 2) // GW_HWNDNEXT
      }

      return null
    }
  } catch (error) {
    console.warn(
      '[capture] Windows 창 경계 감지를 초기화하지 못했습니다:',
      error,
    )
    return null
  }
}
