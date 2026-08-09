import koffi from 'koffi'

export interface NativeWindowRect {
  x: number
  y: number
  width: number
  height: number
}

type WindowEnumerator = () => NativeWindowRect[]

let enumerator: WindowEnumerator | null | undefined

/** 캡처 오버레이를 띄우기 전에 현재 보이는 창을 Z-order 순서로 수집한다. */
export function getVisibleWindowRects(): NativeWindowRect[] {
  if (enumerator === undefined) enumerator = createWindowEnumerator()
  return enumerator?.() ?? []
}

/** Windows의 실제 Z-order를 따라 커서 아래 최상위 앱 창의 경계를 찾는다. */
export function getWindowRectAtPoint(
  x: number,
  y: number,
): NativeWindowRect | null {
  return (
    getVisibleWindowRects().find(
      (rect) =>
        x >= rect.x &&
        x < rect.x + rect.width &&
        y >= rect.y &&
        y < rect.y + rect.height,
    ) ?? null
  )
}

function createWindowEnumerator(): WindowEnumerator | null {
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
    const getDesktopWindow = user32.func('void* GetDesktopWindow()')
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

    return () => {
      const result: NativeWindowRect[] = []
      const seen = new Set<string>()
      // 데스크톱의 첫 자식부터 시작하면 GetTopWindow(null)보다 환경 차이가 적다.
      let hwnd = getWindow(getDesktopWindow(), 5) // GW_CHILD
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

            if (hasRect && width >= 40 && height >= 40) {
              const key = `${rect.left}:${rect.top}:${width}:${height}`
              if (!seen.has(key)) {
                seen.add(key)
                result.push({ x: rect.left, y: rect.top, width, height })
              }
            }
          }
        }

        hwnd = getWindow(hwnd, 2) // GW_HWNDNEXT
      }

      return result
    }
  } catch (error) {
    console.warn(
      '[capture] Windows 창 경계 감지를 초기화하지 못했습니다:',
      error,
    )
    return null
  }
}
