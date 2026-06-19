import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import path from 'node:path'
import { deleteAll } from './db'

let tray: Tray | null = null

interface TrayCallbacks {
  /** 오버레이 창 표시/포커스. */
  onOpen: () => void
  /** 설정 창 열기. */
  onSettings: () => void
  /** 렌더러에 전체 삭제 알림. */
  onCleared: () => void
}

/** assets/icon 없을 때 트레이가 동작하도록 하는 작은 대체 아이콘. */
function loadTrayIcon(): Electron.NativeImage {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'iconTemplate.png'
  const iconPath = path.join(process.env.APP_ROOT ?? app.getAppPath(), 'assets', iconName)
  let img = nativeImage.createFromPath(iconPath)
  if (img.isEmpty() && process.platform === 'darwin') {
    img = nativeImage.createFromPath(
      path.join(process.env.APP_ROOT ?? app.getAppPath(), 'assets', 'icon.ico'),
    )
  }
  if (!img.isEmpty()) {
    if (process.platform === 'darwin') img.setTemplateImage(true)
    return img
  }
  // 아이콘 파일이 없어도 메뉴바에서 보이도록 간단한 template 아이콘을 사용한다.
  const fallback = nativeImage.createFromDataURL(
    `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="black" d="M6 2.5h6a1.5 1.5 0 0 1 1.5 1.5v1H15a1.5 1.5 0 0 1 1.5 1.5V14A1.5 1.5 0 0 1 15 15.5H5A1.5 1.5 0 0 1 3.5 14v-1H3A1.5 1.5 0 0 1 1.5 11.5V4A1.5 1.5 0 0 1 3 2.5h3Zm0 2H3.5V11H5V6.5A1.5 1.5 0 0 1 6.5 5H12V4H6.5a.5.5 0 0 0-.5.5ZM7 7v6.5h8V7H7Z"/></svg>',
    )}`,
  )
  if (process.platform === 'darwin') fallback.setTemplateImage(true)
  return fallback
}

export function createTray({ onOpen, onSettings, onCleared }: TrayCallbacks): Tray {
  tray = new Tray(loadTrayIcon())
  tray.setToolTip('ClipBoard')

  const menu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => onOpen(),
    },
    {
      label: '설정',
      click: () => onSettings(),
    },
    {
      label: '전체 삭제',
      click: () => {
        deleteAll()
        onCleared()
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(menu)

  // 왼쪽 클릭으로도 창 열기 (Windows에서 편리).
  tray.on('click', () => onOpen())

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

/** "cleared" 이벤트를 모든 창에 브로드캐스트하는 편의 함수. */
export function broadcastCleared(): void {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('clipboard:cleared'))
}
