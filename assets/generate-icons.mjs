// assets/icon.svg 에서 배포용 아이콘(icon.png / icon.icns / icon.ico)을 생성한다.
//   node assets/generate-icons.mjs
// Electron 을 오프스크린으로 띄워 SVG 를 각 크기로 래스터화한다(별도 이미지 도구 불필요).
// 아이콘 디자인을 바꿨을 때만 다시 돌리면 된다.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS = dirname(fileURLToPath(import.meta.url))
const ROOT = join(ASSETS, '..')

// 1) Electron 오프스크린 렌더러로 PNG 들을 뽑는다.
const RENDER_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const outDir = join(ROOT, 'node_modules', '.icon-build')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const renderer = join(outDir, 'render.cjs')
writeFileSync(
  renderer,
  `const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const svg = readFileSync(${JSON.stringify(join(ASSETS, 'icon.svg'))}, 'utf8')
const sizes = ${JSON.stringify(RENDER_SIZES)}
const outDir = ${JSON.stringify(outDir)}

// 배율을 2 로 못박아 CSS 512px 창에서 1024 디바이스 픽셀을 얻는다. 창을 1024
// CSS px 로 잡으면 화면 작업영역에 걸려 잘리므로 이렇게 우회한다.
const SCALE = 2
const CSS = 512 // 창 콘텐츠 크기(CSS px) → paint 비트맵은 1024px
app.commandLine.appendSwitch('force-device-scale-factor', String(SCALE))
app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  let win
  try {
    // 오프스크린 창 하나를 만들어 'paint' 비트맵을 받는다.
    //  - capturePage 는 화면 크기에 묶여 큰 이미지를 잘라내지 못한다.
    //  - 창을 새로 만들거나 다시 navigate 하면 두 번째부터 로드가 실패하므로,
    //    한 번만 로드하고 이후에는 JS 로 SVG 크기만 바꾼다.
    win = new BrowserWindow({
      width: CSS,
      height: CSS,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      useContentSize: true,
      webPreferences: { offscreen: true },
    })

    let latest = null
    win.webContents.on('paint', (_e, _dirty, image) => {
      latest = image
    })

    const html =
      '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}' +
      'svg{display:block}</style>' + svg
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

    // 작은 크기는 1024 에서 축소하면 뭉개지므로 각 크기로 직접 그린다.
    for (const size of sizes) {
      const css = size / SCALE
      latest = null
      await win.webContents.executeJavaScript(
        \`(() => { const s = document.querySelector('svg')
          s.style.width = '\${css}px'; s.style.height = '\${css}px'
          return s.getBoundingClientRect().width })()\`
      )
      // 새 프레임이 올 때까지 기다린다.
      for (let i = 0; i < 100 && !latest; i++) await new Promise((r) => setTimeout(r, 50))
      if (!latest) throw new Error(size + 'px 렌더링 시간 초과')
      await new Promise((r) => setTimeout(r, 150))

      const painted = latest.getSize().width
      if (painted < size) throw new Error(size + 'px: paint 비트맵이 ' + painted + 'px 뿐이다')
      const out = latest.crop({ x: 0, y: 0, width: size, height: size })
      writeFileSync(join(outDir, size + '.png'), out.toPNG())
    }
    win.destroy()
    app.quit()
  } catch (err) {
    console.error(err)
    if (win) win.destroy()
    app.exit(1)
  }
})
`,
)

const electronBin = createRequire(import.meta.url)('electron').toString()

const render = spawnSync(electronBin, [renderer], {
  stdio: 'inherit',
  // 이 변수가 켜져 있으면 Electron 이 일반 Node 로 실행돼 API 가 없다(CLAUDE.md 참고).
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
})
if (render.status !== 0) {
  console.error('아이콘 래스터화 실패')
  process.exit(1)
}

const png = (size) => join(outDir, `${size}.png`)

// 2) icon.png (1024) — Linux / 일반 용도
spawnSync('cp', [png(1024), join(ASSETS, 'icon.png')], { stdio: 'inherit' })

// 3) icon.icns — macOS. iconutil 이 요구하는 iconset 이름 규칙에 맞춰 복사한다.
if (process.platform === 'darwin') {
  const iconset = join(outDir, 'icon.iconset')
  mkdirSync(iconset, { recursive: true })
  const ICNS = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ]
  for (const [size, name] of ICNS) {
    spawnSync('cp', [png(size), join(iconset, name)], { stdio: 'inherit' })
  }
  const icns = spawnSync(
    'iconutil',
    ['-c', 'icns', iconset, '-o', join(ASSETS, 'icon.icns')],
    {
      stdio: 'inherit',
    },
  )
  if (icns.status !== 0) console.error('icns 생성 실패 (iconutil)')
} else {
  console.warn('macOS 가 아니라 icon.icns 생성을 건너뛴다.')
}

// 4) icon.ico — Windows. ICO 컨테이너에 PNG 를 그대로 담는 형식(Vista+).
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const entries = ICO_SIZES.map((size) => ({
  size,
  data: readFileSync(png(size)),
}))

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: 1 = icon
header.writeUInt16LE(entries.length, 4)

const DIR_ENTRY = 16
let offset = header.length + entries.length * DIR_ENTRY
const dir = Buffer.concat(
  entries.map(({ size, data }) => {
    const e = Buffer.alloc(DIR_ENTRY)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1) // height
    e.writeUInt8(0, 2) // palette
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // color planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  }),
)
writeFileSync(
  join(ASSETS, 'icon.ico'),
  Buffer.concat([header, dir, ...entries.map((e) => e.data)]),
)

rmSync(outDir, { recursive: true, force: true })
console.log('아이콘 생성 완료: icon.png / icon.icns / icon.ico')
