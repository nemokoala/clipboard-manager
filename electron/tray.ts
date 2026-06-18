import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import path from 'node:path'
import { deleteAll } from './db'

let tray: Tray | null = null

interface TrayCallbacks {
  /** Show / focus the overlay window. */
  onOpen: () => void
  /** Open the settings window. */
  onSettings: () => void
  /** Notify the renderer that all items were cleared. */
  onCleared: () => void
}

/** A tiny fallback icon so the tray still works before assets/icon exists. */
function loadTrayIcon(): Electron.NativeImage {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'iconTemplate.png'
  const iconPath = path.join(process.env.APP_ROOT ?? app.getAppPath(), 'assets', iconName)
  const img = nativeImage.createFromPath(iconPath)
  if (!img.isEmpty()) {
    if (process.platform === 'darwin') img.setTemplateImage(true)
    return img
  }
  // 1x1 transparent placeholder keeps Tray construction from throwing.
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

  // Left-click also opens the window (handy on Windows).
  tray.on('click', () => onOpen())

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

/** Convenience for broadcasting the "cleared" event to all windows. */
export function broadcastCleared(): void {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('clipboard:cleared'))
}
