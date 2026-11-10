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
  display-modes.ts 모니터의 실제 픽셀 해상도 조회 (Windows FFI)
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
    capture.ts         모니터별 캡처 오버레이 + 캡처 결과 미리보기 창
src/        렌더러 (React)
  App.tsx           오버레이 메인 UI
  main.tsx          URL 해시로 오버레이/설정/토스트 분기 렌더링
  components/       SearchBar / TabBar / StorageInfo / SelectionBar / DateGroup /
                    HistoryList / HistoryItem / Settings / Toast
    ui/             Toggle / SegmentedControl / OptionGrid (재사용 컨트롤)
  types/index.ts    공유 타입 (ClipboardAPI 는 preload 에서 typeof 로 파생)
  utils/            accelerator / format / theme / platform / image
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
  여기에 `productName: 'ClipBoard Manager'` 를 추가하면 경로가 통째로 바뀌어 **기존
  사용자의 히스토리(clipboard.db)와 설정(config.json)이 사라진 것처럼 보인다.**
  앱 표시 이름은 `electron-builder.yml` 의 `productName` 이 담당하며, 이건 번들 이름만
  바꾸고 `package.json` 에 주입되지 않는다(배포된 asar 로 확인). Finder 에는
  "ClipBoard Manager", 데이터 폴더는 `clipboard-manager` 로 어긋나 보이지만 그대로 둔다.
  같은 이유로 `electron-builder.yml` 의 `appId` 도 바꾸지 않는다 — macOS 가 권한과
  로그인 항목을 appId 로 기억해서, 바꾸면 기존 사용자가 권한을 다시 허용해야 한다.
- **이미지 썸네일**: 목록에 이미지 원본(수 MB base64)을 실어 보내면 80px 미리보기를
  그리려고 원본을 통째로 디코딩해 탭 전환이 초 단위로 느려진다. 캡처 시점에
  `thumbnail.ts` 로 축소본을 만들어 `thumbnail` 컬럼에 넣고, 조회는
  `COALESCE(thumbnail, content) AS preview` 로 내려보낸다.
  - 렌더러에는 원본이 없으므로 **복사는 `id` 로 요청**하고 메인이 DB 에서 원본을 읽는다.
  - 썸네일은 가로·세로 상한을 함께 걸어야 한다. 높이만 제한하면 가로로 긴 이미지가
    원본 폭 그대로 남아 거의 줄지 않는다.
  - 썸네일 도입 전에 저장된 이미지는 `backfill.ts` 가 배치로 채운다. 한 번에 처리하면
    전부 디코딩하느라 앱 시작이 수 초간 멈춘다.
- **목록 가상 스크롤**: `HistoryList` 는 `@tanstack/react-virtual` 로 화면 근처 행만 그린다.
  날짜 헤더와 카드를 한 줄짜리 행 배열로 펼치고, 그룹 간격은 행의 아래 여백(카드 사이 6px ·
  그룹 끝 8px)으로 재현한다. 전부 DOM 에 올리던 때보다 오버레이 렌더러가 끝까지 스크롤한 뒤
  약 240MB → 70~115MB 로 준다(1317 항목 실측). 데이터는 여전히 `getAllItems()` 로 전부
  받으므로 메인 프로세스 메모리는 그대로다.
  - 라이브러리 기본 `measureElement` 는 높이를 `Math.round` 한다. 헤더·카드 높이가 11px
    글자 × 줄높이 1.5 때문에 30.5px 처럼 끝나서, 반올림하면 행마다 0.5px 씩 벌어져 전체가
    수백 px 길어진다. 소수 높이를 그대로 쓰는 측정 함수를 넘긴다.
  - **이미지는 로드 전에 최종 크기의 자리를 잡아야 한다**(`utils/image.ts` 가 PNG 헤더에서
    크기를 읽음). 디코딩 뒤 높이가 0 → 80px 로 바뀌면 위로 스크롤하는 중에는 라이브러리가 그
    변화를 보정하지 않아 화면이 80px 씩 튄다.
  - 라이브러리 기본값은 **위로 스크롤하는 중의 재측정을 보정하지 않는다**. 창 폭을 바꾸면
    예전 폭에서 잰 높이가 남아 있다가 위로 스크롤할 때 다시 재지면서 화면이 수십~백여 px 씩
    튄다. 그래서 `shouldAdjustScrollPositionOnItemSizeChange` 를 "시작점이 뷰포트 위인 행이면
    항상 보정"으로 바꿨다. 카드가 그려진 뒤 스스로 커지는 일이 없어서 안전하다 — 나중에
    스트리밍처럼 커지는 카드가 생기면 이 조건을 다시 볼 것.
  - 카드에 `content-visibility: auto` 를 다시 넣지 말 것. 여유분으로 미리 그린 화면 밖 행이
    `contain-intrinsic-size` 높이로 측정돼 위치가 어긋난다.
  - **hover·선택으로 카드 크기가 바뀌면 안 된다**(커서 아래 행이 다시 측정됨). 카드 오른쪽 칸은
    시간·번호와 hover 버튼을 grid 한 칸에 겹쳐 두고 `visibility` 만 바꾸며, 선택 표시는 border
    가 아니라 `ring-inset` 과 배경으로 한다.
- **다중 선택 삭제**: Ctrl(⌘)+클릭 토글, Shift+클릭 범위 추가(화면 순서 = 고정 항목 먼저),
  날짜 헤더의 "이 날짜 선택"(고정됨 그룹 제외). 선택 중에는 저장소 현황 줄 대신
  `SelectionBar` 가 나오고, 삭제는 `deleteItems`(한 트랜잭션)로 한다.
  - 선택이 하나라도 있으면 **일반 클릭도 토글**이다. 고르다가 실수로 복사·창 닫힘이 나지 않게.
  - 오버레이는 숨겨질 뿐 파기되지 않으므로 **숨겨질 때(`visibilitychange`) 선택을 비운다**.
    안 그러면 다음에 열었을 때 첫 클릭이 복사가 아니라 토글이 된다. 검색어·탭 변경 때도 비운다.
  - 지우는 대상은 "선택한 id 중 지금 화면에 있는 것"(`selectedVisible`)뿐이다. 목록이 다시
    로드돼 사라진 id 는 자연히 빠진다.
  - `window.confirm` 같은 네이티브 대화상자를 쓰지 말 것 — 오버레이가 포커스를 잃고 숨는다.
    그래서 날짜 삭제도 "선택 → 삭제" 두 단계다.
- **클립보드 변경 감지**: 폴링 tick 마다 이미지를 읽어 비교하면 클립보드에 큰
  이미지가 올라와 있는 것만으로 CPU 를 계속 쓴다. `clipboard-counter.ts` 가 OS 의
  클립보드 변경 카운터(Windows `GetClipboardSequenceNumber`, macOS
  `NSPasteboard.changeCount`)를 koffi(FFI)로 읽어, 카운터가 그대로면 tick 을 정수
  비교 한 번으로 끝낸다. koffi 로드 실패 시에는 원시 비트맵을 sha1 해싱하는 지문
  비교로 폴백한다(`imageFingerprint`). 카운터는 최적화 게이트일 뿐이라 실패해도
  동작은 같다. koffi 는 네이티브 모듈이므로 vite 메인 번들에서 external.
- **화면 캡처(다중 모니터)**: 모니터마다 오버레이 창을 하나씩 띄운다. 여기서 **포커스를
  쓰면 반드시 깨진다** — 키 입력은 활성 창 하나만 받아 다른 모니터에서 Esc/Enter 가 죽고,
  비활성 창의 첫 클릭은 창 활성화에 먹히며, 커서를 따라 포커스를 옮기면 이동 내내 전면
  창이 바뀌어 오버레이가 흔들린다. 그래서 캡처 창은 `focusable: false` + `showInactive()`
  로 **활성화 대상에서 뺀다**. 마우스 입력은 그대로 들어오고, Esc/Enter 는 캡처가 떠 있는
  동안만 메인이 전역 단축키로 잡아 처리한다(닫을 때 반드시 해제 — 안 하면 Esc 가 시스템
  전역에서 먹힌 채로 남는다).
  - **캡처 화질: `thumbnailSize` 는 반드시 모니터의 진짜 픽셀 해상도여야 한다.**
    `bounds × scaleFactor` 로 계산하면 안 된다 — `bounds` 가 이미 반올림된 DIP 라
    175% 배율에서 3840 이 3841 로 되돌아온다. 그 1px 때문에 `desktopCapturer` 가
    화면 전체를 3841 로 확대하고 다시 3840 으로 줄이는 이중 리샘플이 일어나,
    화면 한가운데서 반 픽셀씩 어긋나며 글자가 뭉갠다(실측 선명도 1/8~1/3).
    `display-modes.ts` 가 `EnumDisplayDevicesW` + `EnumDisplaySettingsW` 로 실제
    해상도와 물리 좌표를 읽고, `screen.dipToScreenPoint(bounds 원점)` 으로 짝짓는다.
    FFI 가 없으면 계산값으로 폴백한다. `thumbnailSize` 는 모든 소스에 공통이므로
    해상도가 같은 모니터끼리 묶어 묶음마다 한 번씩 `getSources` 를 부른다(보통 1회).
  - 스크린샷은 **렌더러에 원본을 보내지 않는다**. 렌더러에는 물리 해상도 JPEG 만
    보낸다(`encodePreview`). 4K PNG data URL 은 모니터당 1.3~3.5MB · 인코딩
    264~412ms 라 창이 여러 개면 메인이 눈에 띄게 멎는다. 같은 4K JPEG 는 ~1MB ·
    34~39ms 다. 실제 잘라내기는 메인의 원본으로 한다.
  - **화면에 스크린샷을 그릴 때는 항상 `devicePixelRatio` 로 나눠야 한다.** 이미지의
    기본 크기는 "픽셀 수 = CSS px" 로 잡히므로, 배율이 걸린 화면에 그대로 두면
    devicePixelRatio 배로 확대돼 흐려진다. 캡처 결과 미리보기 창이 이 함정에 빠져
    875px 이미지를 175% 모니터에서 1531 물리픽셀로 늘려 그렸다(선명도 1/35).
    `<img>` 는 `width`/`height` 를 직접 주지 말고 `max-width`/`max-height` 에
    `min(100%, 픽셀수 ÷ dpr px)` 를 건다 — 두 축을 직접 고정하면 상한이 따로 걸려
    비율이 깨진다. 창을 배율이 다른 모니터로 옮기면 dpr 이 바뀌므로 `resize` 로 갱신한다.
  - **배경을 창 크기에 맞춰 늘리지 말 것**(`backgroundSize: 100% 100%`). 창 크기는
    DIP 반올림 때문에 이미지보다 1~3px 커서, 늘리면 화면 전체가 미세하게 확대되며
    또 흐려진다. `imageWidth / devicePixelRatio` CSS 크기로 깔아 이미지 1픽셀을
    화면 1픽셀에 얹는다. 같은 이유로 잘라내기 좌표 환산도 `bounds` 비율이 아니라
    `scaleFactor` 를 쓴다.
  - 상태 전달은 **렌더러가 가져가는(pull) 쪽**이 정답이다. 메인이 `did-finish-load` 에
    `capture:ready` 를 push 하면 React 가 리스너를 등록하기 전에 도착할 수 있고, 그
    모니터만 검은 화면으로 남는다. 창 여러 개가 동시에 로드되면 훨씬 잦다. 렌더러는
    마운트 직후 `#capture?display=<id>` 의 id 로 `capture:getState` 를 호출한다.
  - 커서 아래 창 자동 감지(`getCaptureRegion`)는 pointermove 마다 IPC 를 던지면 초당
    수백 번이 되므로 `requestAnimationFrame` 으로 프레임당 한 번으로 묶는다.
- **DB 마이그레이션**: 새 컬럼은 `initDb()` 의 `addMissingColumns()` 에서
  `PRAGMA table_info` 로 확인해 `ALTER TABLE` 로 추가한다. `SELECT` 는 컬럼을 명시적으로
  나열하므로 구버전으로 롤백해도 새 컬럼을 무시하고 동작한다.
