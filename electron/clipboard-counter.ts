import koffi from 'koffi'

/**
 * OS 클립보드 변경 카운터.
 *
 * 클립보드 내용이 바뀔 때마다 OS 가 1씩 올려 주는 정수를 읽는다. 폴링 tick 에서
 * 이 정수만 비교하면 "바뀌었는지"를 이미지/텍스트를 실제로 읽지 않고 알 수 있어,
 * 클립보드에 큰 이미지가 올라와 있어도 유휴 CPU 가 사실상 0 이 된다.
 *
 * Electron 의 clipboard 모듈은 이 카운터를 노출하지 않아 koffi(FFI)로 OS API 를
 * 직접 호출한다:
 * - Windows: user32.dll 의 `GetClipboardSequenceNumber()` (평범한 C 함수)
 * - macOS: `NSPasteboard.generalPasteboard.changeCount` — Objective-C 메서드라서
 *   objc 런타임의 C API(objc_getClass / sel_registerName / objc_msgSend)로 풀어 호출
 *
 * 로드에 실패하면 null 을 반환하고, 호출부(clipboard.ts)는 비트맵 지문 비교로
 * 폴백한다. 카운터는 최적화 게이트일 뿐 정확성의 원천이 아니므로 실패해도 안전하다.
 */
export function createClipboardCounter(): (() => number) | null {
  try {
    if (process.platform === 'win32') return createWindowsCounter()
    if (process.platform === 'darwin') return createMacCounter()
    return null
  } catch (err) {
    console.warn('[clipboard] 변경 카운터 초기화 실패 — 지문 비교로 폴백:', err)
    return null
  }
}

function createWindowsCounter(): () => number {
  const user32 = koffi.load('user32.dll')
  const getSequenceNumber = user32.func('uint32_t GetClipboardSequenceNumber()')
  return () => getSequenceNumber() as number
}

function createMacCounter(): () => number {
  const objc = koffi.load('/usr/lib/libobjc.A.dylib')
  const getClass = objc.func('void* objc_getClass(const char*)')
  const registerSel = objc.func('void* sel_registerName(const char*)')
  // objc_msgSend 는 보내는 메시지의 실제 시그니처로 캐스팅해 호출하는 게 공식
  // 사용법이라, 같은 심볼을 반환형별로 따로 선언한다.
  const msgSendPtr = objc.func('void* objc_msgSend(void*, void*)')
  const msgSendLong = objc.func('long objc_msgSend(void*, void*)')

  // NSPasteboard 는 AppKit 클래스지만 Electron 메인 프로세스에는 AppKit 이
  // 항상 로드돼 있어 바로 찾을 수 있다. generalPasteboard 는 싱글턴이라 캐시한다.
  const pasteboard = msgSendPtr(
    getClass('NSPasteboard'),
    registerSel('generalPasteboard'),
  )
  const selChangeCount = registerSel('changeCount')

  return () => msgSendLong(pasteboard, selChangeCount) as number
}
