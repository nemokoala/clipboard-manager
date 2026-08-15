import koffi from 'koffi'

/** 모니터의 실제 픽셀 해상도와 물리(가상 데스크톱) 좌표. */
export interface NativeDisplayMode {
  x: number
  y: number
  width: number
  height: number
}

type ModeReader = () => NativeDisplayMode[]

let reader: ModeReader | null | undefined

/**
 * 모니터의 진짜 픽셀 해상도를 읽는다. Windows 외에는 빈 배열.
 *
 * Electron 의 `display.bounds` 는 이미 반올림된 DIP 라서 `bounds × scaleFactor` 로는
 * 물리 해상도를 되돌릴 수 없다. 3840 을 175% 로 나누면 2194.28 인데 Electron 은
 * 2195 로 올려 보고하고, 이걸 다시 곱하면 3841 이 나온다. 그 1px 때문에
 * `desktopCapturer` 가 화면 전체를 확대·축소 리샘플해 눈에 띄게 흐려진다.
 */
export function getNativeDisplayModes(): NativeDisplayMode[] {
  if (reader === undefined) reader = createModeReader()
  return reader?.() ?? []
}

function createModeReader(): ModeReader | null {
  if (process.platform !== 'win32') return null

  try {
    const user32 = koffi.load('user32.dll')
    const displayDevice = koffi.struct('DisplayDeviceW', {
      cb: 'uint32_t',
      DeviceName: koffi.array('uint16_t', 32),
      DeviceString: koffi.array('uint16_t', 128),
      StateFlags: 'uint32_t',
      DeviceID: koffi.array('uint16_t', 128),
      DeviceKey: koffi.array('uint16_t', 128),
    })
    // DEVMODEW 는 필드를 하나라도 빠뜨리면 오프셋이 밀려 엉뚱한 값을 읽는다.
    // 쓰지 않는 뒷부분까지 전부 선언해 크기(220바이트)를 맞춘다.
    const devMode = koffi.struct('DevModeW', {
      dmDeviceName: koffi.array('uint16_t', 32),
      dmSpecVersion: 'uint16_t',
      dmDriverVersion: 'uint16_t',
      dmSize: 'uint16_t',
      dmDriverExtra: 'uint16_t',
      dmFields: 'uint32_t',
      dmPositionX: 'int32_t',
      dmPositionY: 'int32_t',
      dmDisplayOrientation: 'uint32_t',
      dmDisplayFixedOutput: 'uint32_t',
      dmColor: 'int16_t',
      dmDuplex: 'int16_t',
      dmYResolution: 'int16_t',
      dmTTOption: 'int16_t',
      dmCollate: 'int16_t',
      dmFormName: koffi.array('uint16_t', 32),
      dmLogPixels: 'uint16_t',
      dmBitsPerPel: 'uint32_t',
      dmPelsWidth: 'uint32_t',
      dmPelsHeight: 'uint32_t',
      dmDisplayFlags: 'uint32_t',
      dmDisplayFrequency: 'uint32_t',
      dmICMMethod: 'uint32_t',
      dmICMIntent: 'uint32_t',
      dmMediaType: 'uint32_t',
      dmDitherType: 'uint32_t',
      dmReserved1: 'uint32_t',
      dmReserved2: 'uint32_t',
      dmPanningWidth: 'uint32_t',
      dmPanningHeight: 'uint32_t',
    })
    const deviceSize = koffi.sizeof(displayDevice)
    const modeSize = koffi.sizeof(devMode)

    const enumDisplayDevices = user32.func(
      'bool EnumDisplayDevicesW(const char16_t*, uint32_t, _Inout_ DisplayDeviceW*, uint32_t)',
    )
    const enumDisplaySettings = user32.func(
      'bool EnumDisplaySettingsW(const char16_t*, uint32_t, _Inout_ DevModeW*)',
    )

    return () => {
      const modes: NativeDisplayMode[] = []

      for (let index = 0; index < 32; index += 1) {
        const device = {
          cb: deviceSize,
          DeviceName: new Array<number>(32).fill(0),
          DeviceString: new Array<number>(128).fill(0),
          StateFlags: 0,
          DeviceID: new Array<number>(128).fill(0),
          DeviceKey: new Array<number>(128).fill(0),
        }
        if (!enumDisplayDevices(null, index, device, 0)) break
        // DISPLAY_DEVICE_ATTACHED_TO_DESKTOP
        if ((device.StateFlags & 0x1) === 0) continue

        const mode = {
          dmDeviceName: new Array<number>(32).fill(0),
          dmSpecVersion: 0,
          dmDriverVersion: 0,
          dmSize: modeSize,
          dmDriverExtra: 0,
          dmFields: 0,
          dmPositionX: 0,
          dmPositionY: 0,
          dmDisplayOrientation: 0,
          dmDisplayFixedOutput: 0,
          dmColor: 0,
          dmDuplex: 0,
          dmYResolution: 0,
          dmTTOption: 0,
          dmCollate: 0,
          dmFormName: new Array<number>(32).fill(0),
          dmLogPixels: 0,
          dmBitsPerPel: 0,
          dmPelsWidth: 0,
          dmPelsHeight: 0,
          dmDisplayFlags: 0,
          dmDisplayFrequency: 0,
          dmICMMethod: 0,
          dmICMIntent: 0,
          dmMediaType: 0,
          dmDitherType: 0,
          dmReserved1: 0,
          dmReserved2: 0,
          dmPanningWidth: 0,
          dmPanningHeight: 0,
        }
        // ENUM_CURRENT_SETTINGS (-1)
        if (!enumDisplaySettings(decodeName(device.DeviceName), 0xffffffff, mode))
          continue
        if (mode.dmPelsWidth < 1 || mode.dmPelsHeight < 1) continue

        modes.push({
          x: mode.dmPositionX,
          y: mode.dmPositionY,
          width: mode.dmPelsWidth,
          height: mode.dmPelsHeight,
        })
      }

      return modes
    }
  } catch (error) {
    console.warn('[capture] 모니터 해상도 조회를 초기화하지 못했습니다:', error)
    return null
  }
}

/** DeviceName 은 널 종료 UTF-16 배열로 돌아온다. */
function decodeName(chars: number[]): string {
  const end = chars.indexOf(0)
  return String.fromCharCode(...chars.slice(0, end === -1 ? chars.length : end))
}
