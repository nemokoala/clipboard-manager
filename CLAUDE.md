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
npm run lint     # ESLint
npm run format   # Prettier 일괄 포맷
npm run dist:win # Windows NSIS 빌드
npm run dist:mac # macOS DMG 빌드
```

코드 스타일은 Prettier 가 강제한다(작은따옴표, 세미콜론 없음). 커밋 전 `npm run lint`
를 통과시킬 것.

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
  main.ts       앱 부트스트랩만 — whenReady 배선 / 종료 정리
  ipc.ts        모든 IPC 채널 등록 (db / window / settings)
  preload.ts    contextBridge 로 window.clipboardAPI 노출
  db.ts         better-sqlite3 CRUD + purgeOldItems (Electron 비의존)
  clipboard.ts  클립보드 폴링
  classify.ts   text / link 분류 (순수 함수)
  thumbnail.ts  이미지 축소본 생성 (NativeImage → PNG data URL)
  backfill.ts   기존 이미지의 썸네일을 배치로 채우는 백그라운드 작업
  settings.ts   electron-store 기반 설정 저장
  shortcuts.ts  전역 단축키 등록 / 해제 / 복원
  theme.ts      다크 여부 판정 + 창 배경색
  broadcast.ts  모든 창에 이벤트 전파 (refresh / theme)
  purge.ts      보관 정책 실행
  launch.ts     로그인 시 자동 실행
  tray.ts       트레이 아이콘 + 메뉴
  windows/
    shared.ts          APP_ROOT / loadRoute / 공통 webPreferences
    overlay.ts         오버레이 창
    settings-window.ts 설정 창
    toast.ts           토스트 창
src/        렌더러 (React)
  App.tsx           오버레이 메인 UI
  main.tsx          URL 해시로 오버레이/설정/토스트 분기 렌더링
  components/       SearchBar / TabBar / StorageInfo / DateGroup /
                    HistoryList / HistoryItem / Settings / Toast
    ui/             Toggle / SegmentedControl / OptionGrid (재사용 컨트롤)
  types/index.ts    공유 타입 (ClipboardAPI 는 preload 에서 typeof 로 파생)
  utils/            accelerator / format / theme / platform
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
- **API 타입의 단일 원천**: `window.clipboardAPI` 의 타입은 preload 의 실제 객체에서
  `typeof clipboardAPI` 로 파생시킨다(`src/types/index.ts`). 인터페이스를 손으로 다시
  적지 말 것 — preload 와 조용히 어긋난다.
- **모듈 경계**: `db.ts` 와 `classify.ts` 는 `electron` 을 import 하지 않는다. DB 경로는
  `initDb(dbPath)` 로 주입받는다. 창 모듈은 `windows/` 아래에 두고, 순환 참조를 피하려고
  overlay 는 설정 창을 직접 import 하지 않고 `isSettingsVisible` 콜백을 주입받는다.
- **blur 자동 숨김**: 오버레이의 `blur` 핸들러는 `setTimeout(…, 0)` 안에서 판단해야 한다.
  설정 버튼을 누르면 blur 가 설정 창이 뜨기 전에 먼저 발생해, 미루지 않으면
  `isSettingsVisible()` 이 거짓을 보고 오버레이가 닫혀버린다.
- **⚠️ `package.json` 의 `name` 을 바꾸거나 `productName` 을 추가하지 말 것**:
  Electron 의 `app.getName()` 이 `userData` 경로를 정하는데, 이 값은 `package.json` 의
  `productName` → `name` 순으로 결정된다. 지금은 `name: clipboard-manager` 만 있어
  데이터가 `~/Library/Application Support/clipboard-manager/` 에 쌓인다.
  여기에 `productName: 'Simple Clipboard'` 를 추가하면 경로가 통째로 바뀌어 **기존
  사용자의 히스토리(clipboard.db)와 설정(config.json)이 사라진 것처럼 보인다.**
  앱 표시 이름은 `electron-builder.yml` 의 `productName` 이 담당하며, 이건 번들 이름만
  바꾸고 `package.json` 에 주입되지 않는다(배포된 asar 로 확인). Finder 에는
  "Simple Clipboard", 데이터 폴더는 `clipboard-manager` 로 어긋나 보이지만 그대로 둔다.
- **이미지 썸네일**: 목록에 이미지 원본(수 MB base64)을 실어 보내면 80px 미리보기를
  그리려고 원본을 통째로 디코딩해 탭 전환이 초 단위로 느려진다. 캡처 시점에
  `thumbnail.ts` 로 축소본을 만들어 `thumbnail` 컬럼에 넣고, 조회는
  `COALESCE(thumbnail, content) AS preview` 로 내려보낸다.
  - 렌더러에는 원본이 없으므로 **복사는 `id` 로 요청**하고 메인이 DB 에서 원본을 읽는다.
  - 썸네일은 가로·세로 상한을 함께 걸어야 한다. 높이만 제한하면 가로로 긴 이미지가
    원본 폭 그대로 남아 거의 줄지 않는다.
  - 썸네일 도입 전에 저장된 이미지는 `backfill.ts` 가 배치로 채운다. 한 번에 처리하면
    전부 디코딩하느라 앱 시작이 수 초간 멈춘다.
- **클립보드 변경 감지**: 폴링 tick 마다 이미지를 읽어 비교하면 클립보드에 큰
  이미지가 올라와 있는 것만으로 CPU 를 계속 쓴다. `clipboard-counter.ts` 가 OS 의
  클립보드 변경 카운터(Windows `GetClipboardSequenceNumber`, macOS
  `NSPasteboard.changeCount`)를 koffi(FFI)로 읽어, 카운터가 그대로면 tick 을 정수
  비교 한 번으로 끝낸다. koffi 로드 실패 시에는 원시 비트맵을 sha1 해싱하는 지문
  비교로 폴백한다(`imageFingerprint`). 카운터는 최적화 게이트일 뿐이라 실패해도
  동작은 같다. koffi 는 네이티브 모듈이므로 vite 메인 번들에서 external.
- **DB 마이그레이션**: 새 컬럼은 `initDb()` 의 `addMissingColumns()` 에서
  `PRAGMA table_info` 로 확인해 `ALTER TABLE` 로 추가한다. `SELECT` 는 컬럼을 명시적으로
  나열하므로 구버전으로 롤백해도 새 컬럼을 무시하고 동작한다.
