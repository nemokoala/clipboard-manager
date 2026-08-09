// electron-builder afterPack 훅: 앱 번들을 ad-hoc(무료) 서명한다.
// Apple Developer 인증서 없이도 arm64 에서 "손상되었기 때문에 열 수 없습니다"
// 오류를 없애준다. (미확인 개발자 경고는 남으므로 사용자는 우클릭→열기로 실행)
// electron-builder 는 identity: null 이면 서명을 건너뛰므로 여기서 직접 서명한다.
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  // macOS 빌드에서만 codesign 을 수행한다.
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  // ad-hoc 서명("-"). --deep 로 asarUnpack 된 네이티브 모듈(better-sqlite3,
  // koffi)까지 함께 서명한다. --force 로 기존(자동) 서명을 덮어쓴다.
  //
  // ⚠️ entitlements 를 붙이지 않는다. entitlements.mac.plist 의
  // com.apple.security.cs.* 키는 하드닝 런타임 전용의 "제한된" entitlement 라,
  // 팀 ID 가 없는 ad-hoc 서명에 붙이면 AMFI 가 실행을 거부한다(launchd spawn
  // failed / POSIX 163 → "응용 프로그램을 열 수 없습니다"). 하드닝 런타임을
  // 쓰지 않는 ad-hoc 에선 JIT·unsigned-memory 가 기본 허용이라 필요도 없다.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  })

  console.log(`[afterPack] ad-hoc 서명 완료: ${appName}`)
}
