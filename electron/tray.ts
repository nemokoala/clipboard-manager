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
  const img = nativeImage.createFromPath(iconPath)
  if (!img.isEmpty()) {
    if (process.platform === 'darwin') img.setTemplateImage(true)
    return img
  }
  // 1x1 투명 placeholder로 Tray 생성 예외를 방지한다.
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  )
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
