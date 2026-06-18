# ClipBoard — 클립보드 히스토리 매니저

Electron + React + TailwindCSS + better-sqlite3 로 만든, 클립보드 기록을 영구
저장하는 데스크탑 앱입니다. macOS / Windows 모두 지원합니다.

## 기능

- **자동 캡처**: 500ms 폴링으로 클립보드 변경을 감지해 저장 (중복 제외)
- **타입 분류**: `text` / `link`(http·https) / `image`(PNG base64) 자동 구분
- **영구 저장**: `better-sqlite3` 로 로컬 DB(`userData/clipboard.db`)에 저장
- **오버레이 창**: `Ctrl/Cmd + Shift + V` 토글, 포커스 잃으면 자동 숨김
- **트레이**: 열기 / 전체 삭제 / 종료
- **UI**: 검색, 탭 필터(전체·텍스트·이미지·링크), 날짜 그룹, 용량 표시 바
- 글래스모피즘 다크 테마 (macOS vibrancy, Windows acrylic)

## 개발

```bash
npm install      # 의존성 설치 + better-sqlite3 네이티브 리빌드
npm run dev      # Vite 개발 서버 + Electron 자동 실행
npm run build    # 타입체크(tsc) + 프로덕션 번들
```

### ⚠️ `ELECTRON_RUN_AS_NODE` 주의

현재 셸 환경에 `ELECTRON_RUN_AS_NODE=1` 이 설정되어 있으면 Electron 이 **일반
Node 로 실행**되어 `require('electron')` 이 API 객체 대신 실행파일 경로 문자열을
반환합니다(→ `app.whenReady` 가 undefined). 앱 실행 전에 해제하세요.

```powershell
# PowerShell
$env:ELECTRON_RUN_AS_NODE=$null ; npm run dev
```

```bash
# bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```

## 빌드 / 배포

```bash
npm run dist:win   # Windows NSIS 설치 프로그램
npm run dist:mac   # macOS DMG
```

배포 전 `assets/` 에 아이콘을 넣어주세요 (자세한 내용은 `assets/README.md`):
- `icon.ico` (Windows, 트레이 포함)
- `icon.icns` (macOS)
- `iconTemplate.png` (macOS 트레이)

아이콘이 없어도 개발 실행은 가능합니다(투명 플레이스홀더 폴백).

## 구조

```
electron/   main.ts · clipboard.ts · db.ts · tray.ts · preload.ts
src/        App.tsx · main.tsx · components/ · types/ · utils/
```

### 보안

- `contextIsolation: true`, `nodeIntegration: false`
- 네이티브 모듈(`better-sqlite3`)은 메인 프로세스에서만 사용
- 렌더러는 `window.clipboardAPI`(preload contextBridge) 를 통해서만 DB/클립보드 접근
