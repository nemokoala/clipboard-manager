# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에 대한 가이드입니다.

## 작성 규칙 (중요)

- **코드 주석은 모두 한글로 작성한다.** 새 코드를 추가하거나 기존 코드를 수정할 때 주석은 한국어로 쓴다.
- 커밋 메시지에 Claude / AI 가 작업했다는 표기(Co-Authored-By 등)를 넣지 않는다.
- 사용자와의 대화는 한국어로 한다.

## 프로젝트 개요

Electron + React + TailwindCSS + better-sqlite3 로 만든 클립보드 히스토리
데스크탑 앱. macOS / Windows 지원.

- 메인 프로세스가 클립보드를 500ms 간격으로 폴링해 변경분을 SQLite 에 저장
- 전역 단축키(기본 `Ctrl/Cmd+Shift+V`)로 frameless 오버레이 창을 토글
- 시스템 트레이 + 설정 창에서 단축키 변경(electron-store 로 영구 저장)

## 명령어

```bash
npm install      # 의존성 설치 + better-sqlite3 네이티브 리빌드
npm run dev      # Vite 개발 서버 + Electron 자동 실행
npm run build    # 타입체크(tsc) + 프로덕션 번들
npm run dist:win # Windows NSIS 빌드
npm run dist:mac # macOS DMG 빌드
```

### ⚠️ 실행 시 주의: `ELECTRON_RUN_AS_NODE`

현재 셸 환경에 `ELECTRON_RUN_AS_NODE=1` 이 설정돼 있으면 Electron 이 일반 Node 로
실행되어 `require('electron')` 이 API 대신 경로 문자열을 반환한다(→ `app.whenReady`
undefined). 실행 전에 반드시 해제할 것.

```powershell
$env:ELECTRON_RUN_AS_NODE=$null ; npm run dev   # PowerShell
```

## 구조

```
electron/   메인 프로세스 (CommonJS 로 빌드)
  main.ts       BrowserWindow / 전역 단축키 / IPC / 설정 창
  clipboard.ts  클립보드 폴링 + 타입 분류(text/link/image)
  db.ts         better-sqlite3 CRUD
  settings.ts   electron-store 기반 설정 저장(단축키)
  tray.ts       트레이 아이콘 + 메뉴
  preload.ts    contextBridge 로 window.clipboardAPI 노출
src/        렌더러 (React)
  App.tsx           오버레이 메인 UI
  components/        SearchBar / TabBar / StorageBar / DateGroup /
                     HistoryList / HistoryItem / Settings
  types/index.ts    공유 타입 + window.clipboardAPI 타입
  utils/format.ts   날짜 그룹/시간/용량 포맷
```

## 아키텍처 메모

- **빌드 포맷**: `package.json` 에 `"type": "module"` 을 두지 않는다. 메인/preload 는
  CommonJS(`.js`)로 빌드되어야 `require('electron')` 의 named export 가 동작한다.
  (ESM 으로 빌드하면 named import 가 깨진다.) `postcss.config.js` 도 CJS 형식.
- **보안**: `contextIsolation: true`, `nodeIntegration: false`. 네이티브 모듈
  (better-sqlite3)은 메인 프로세스에서만 사용하고, 렌더러는 preload 의
  `window.clipboardAPI` 를 통해서만 DB/클립보드에 접근한다.
- **설정 창**: 같은 렌더러 번들을 `#settings` 해시로 로드해 `main.tsx` 에서 분기
  렌더링한다. 별도 HTML 파일을 만들지 않는다.
- **창 모양/블러**: 오버레이는 실제 배경 블러를 위해 OS 재질을 쓴다. CSS
  `backdrop-filter` 는 창 뒤 데스크탑을 흐리지 못하므로 OS 재질이 필요하다.
  - Windows: `backgroundMaterial: 'acrylic'` (불투명 창이라야 동작 → `transparent: false`).
  - macOS: `vibrancy: 'under-window'` (`transparent: true` 와 함께).
  둥근 모서리는 `roundedCorners: true` (OS 기본 라운딩)을 따른다. 패널 배경은
  `bg-white/70` · `dark:bg-ink/65` 처럼 반투명으로 둬 블러가 비치게 한다. 드래그 이동은
  SearchBar 에 `.drag-region`, 내부 컨트롤에 `.no-drag` 클래스로 처리한다.
- **테마**: 라이트/다크/시스템 3가지. `electron-store` 의 `theme` 에 저장하고,
  `dark` 클래스를 `<html>` 에 토글(`src/utils/theme.ts`)해 Tailwind 다크 변형을 켠다.
  변경은 모든 창에 `theme:changed` 로 전파하며, 시스템 모드는 `nativeTheme` /
  `prefers-color-scheme` 를 따른다.
- **단축키 녹화**: 설정에서 녹화 중에는 `settings:setRecording` 으로 전역 단축키를
  잠시 해제해야 한다. 그래야 입력한 조합이 오버레이를 띄우지 않고 렌더러까지 도달한다.
