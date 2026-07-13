import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'node:path'
import { broadcastCleared } from './broadcast'
import { deleteAll } from './db'

let tray: Tray | null = null

interface TrayCallbacks {
  /** 오버레이 창 표시/포커스. */
  onOpen: () => void
  /** 설정 창 열기. */
  onSettings: () => void
}

/** 트레이 아이콘이 없을 때 쓰는 클립보드 모양 대체 아이콘 (SVG data URL). */
const FALLBACK_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="black" d="M6 2.5h6a1.5 1.5 0 0 1 1.5 1.5v1H15a1.5 1.5 0 0 1 1.5 1.5V14A1.5 1.5 0 0 1 15 15.5H5A1.5 1.5 0 0 1 3.5 14v-1H3A1.5 1.5 0 0 1 1.5 11.5V4A1.5 1.5 0 0 1 3 2.5h3Zm0 2H3.5V11H5V6.5A1.5 1.5 0 0 1 6.5 5H12V4H6.5a.5.5 0 0 0-.5.5ZM7 7v6.5h8V7H7Z"/></svg>'

function assetPath(name: string): string {
  return path.join(process.env.APP_ROOT ?? app.getAppPath(), 'assets', name)
}

/** 아이콘 파일이 없어도 트레이가 동작하도록 대체 아이콘까지 준비한다. */
function loadTrayIcon(): Electron.NativeImage {
  const isMac = process.platform === 'darwin'
  const candidates = isMac
    ? ['iconTemplate.png', 'icon.ico']
    : ['icon.ico', 'iconTemplate.png']

  for (const name of candidates) {
    const image = nativeImage.createFromPath(assetPath(name))
    if (image.isEmpty()) continue
    // macOS 템플릿 이미지는 메뉴바 밝기에 맞춰 자동으로 반전된다.
    if (isMac) image.setTemplateImage(true)
    return image
  }

  const fallback = nativeImage.createFromDataURL(
    `data:image/svg+xml;utf8,${encodeURIComponent(FALLBACK_ICON_SVG)}`,
  )
  if (isMac) fallback.setTemplateImage(true)
  return fallback
}

export function createTray({ onOpen, onSettings }: TrayCallbacks): Tray {
  tray = new Tray(loadTrayIcon())
  tray.setToolTip('Simple Clipboard')

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '열기', click: onOpen },
      { label: '설정', click: onSettings },
      {
        label: '전체 삭제',
        click: () => {
          deleteAll()
          broadcastCleared()
        },
      },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() },
    ]),
  )

  // 왼쪽 클릭으로도 창 열기 (Windows 에서 편리).
  tray.on('click', onOpen)

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
