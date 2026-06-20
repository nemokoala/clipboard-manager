import { useEffect, useState } from 'react'
import type { QuickCopyModifier, ThemeMode } from '../types'
import { isMacLike } from '../utils/platform'
import { setTheme as applyTheme } from '../utils/theme'

const IS_MAC = isMacLike()

/** KeyboardEvent.code를 Electron accelerator의 키 부분으로 변환한다. */
function codeToKey(code: string): string | null {
  let m: RegExpExecArray | null
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1]
  if ((m = /^Digit(\d)$/.exec(code))) return m[1]
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code // F1~F24
  const map: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Space: 'Space',
    Enter: 'Return',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Tab: 'Tab',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Backquote: '`',
  }
  return map[code] ?? null
}

/** keydown 이벤트에서 Electron accelerator를 만들거나, 유효하지 않으면 null. */
function eventToAccelerator(e: React.KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = codeToKey(e.nativeEvent.code)
  if (!key) return null
  // 보조키 최소 1개 필요 — 단독 키는 전역 단축키로 부적합.
  if (parts.length === 0) return null

  parts.push(key)
  return parts.join('+')
}

/** accelerator를 표시용으로 예쁘게 포맷한다 (Ctrl/⌘ 등). */
function prettyAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl') return IS_MAC ? '⌘' : 'Ctrl'
      if (part === 'Alt') return IS_MAC ? '⌥' : 'Alt'
      if (part === 'Shift') return IS_MAC ? '⇧' : 'Shift'
      if (part === 'Super') return IS_MAC ? '⌘' : 'Win'
      return part
    })
    .join(IS_MAC ? ' ' : ' + ')
}

function prettyQuickCopyModifier(modifier: QuickCopyModifier): string {
  if (modifier === 'primary') return IS_MAC ? '⌘' : 'Ctrl'
  if (modifier === 'alt') return IS_MAC ? '⌥' : 'Alt'
  return IS_MAC ? '⇧' : 'Shift'
}

const QUICK_COPY_OPTIONS: QuickCopyModifier[] = ['primary', 'alt', 'shift']

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템' },
]

// 자동 정리 옵션(0 = 제한 없음). 고정한 항목은 정리에서 제외된다.
const RETENTION_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '무제한' },
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
]

const MAX_ITEMS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '무제한' },
  { value: 100, label: '100개' },
  { value: 500, label: '500개' },
  { value: 1000, label: '1000개' },
]

export default function Settings() {
  // 모든 설정은 변경 즉시 적용·저장한다(저장 버튼 없음).
  const [shortcut, setShortcut] = useState('')
  const [defaultShortcut, setDefaultShortcut] = useState('')
  const [quickCopyModifier, setQuickCopyModifier] =
    useState<QuickCopyModifier>('primary')
  const [defaultQuickCopyModifier, setDefaultQuickCopyModifier] =
    useState<QuickCopyModifier>('primary')
  const [hideOnBlur, setHideOnBlur] = useState(true)
  const [defaultHideOnBlur, setDefaultHideOnBlur] = useState(true)
  const [launchAtLogin, setLaunchAtLogin] = useState(false)
  const [defaultLaunchAtLogin, setDefaultLaunchAtLogin] = useState(false)
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [defaultTheme, setDefaultTheme] = useState<ThemeMode>('system')
  const [retentionDays, setRetentionDays] = useState(0)
  const [defaultRetentionDays, setDefaultRetentionDays] = useState(0)
  const [maxItems, setMaxItems] = useState(0)
  const [defaultMaxItems, setDefaultMaxItems] = useState(0)
  const [recording, setRecording] = useState(false)
  // 단축키 등록 실패 시에만 표시하는 에러 메시지.
  const [error, setError] = useState('')

  useEffect(() => {
    window.clipboardAPI.getSettings().then((s) => {
      setShortcut(s.shortcut)
      setDefaultShortcut(s.defaultShortcut)
      setQuickCopyModifier(s.quickCopyModifier)
      setDefaultQuickCopyModifier(s.defaultQuickCopyModifier)
      setHideOnBlur(s.hideOnBlur)
      setDefaultHideOnBlur(s.defaultHideOnBlur)
      setLaunchAtLogin(s.launchAtLogin)
      setDefaultLaunchAtLogin(s.defaultLaunchAtLogin)
      setThemeState(s.theme)
      setDefaultTheme(s.defaultTheme)
      setRetentionDays(s.retentionDays)
      setDefaultRetentionDays(s.defaultRetentionDays)
      setMaxItems(s.maxItems)
      setDefaultMaxItems(s.defaultMaxItems)
    })
  }, [])

  const handleSelectTheme = (next: ThemeMode) => {
    setThemeState(next)
    applyTheme(next)
    void window.clipboardAPI.setTheme(next)
  }

  const handleSelectQuickCopy = (modifier: QuickCopyModifier) => {
    setQuickCopyModifier(modifier)
    void window.clipboardAPI.setQuickCopyModifier(modifier)
  }

  const handleToggleHideOnBlur = () => {
    const next = !hideOnBlur
    setHideOnBlur(next)
    void window.clipboardAPI.setHideOnBlur(next)
  }

  const handleToggleLaunchAtLogin = () => {
    const next = !launchAtLogin
    setLaunchAtLogin(next)
    void window.clipboardAPI.setLaunchAtLogin(next)
  }

  const handleSelectRetention = (days: number) => {
    setRetentionDays(days)
    void window.clipboardAPI.setRetentionDays(days)
  }

  const handleSelectMaxItems = (max: number) => {
    setMaxItems(max)
    void window.clipboardAPI.setMaxItems(max)
  }

  /** 단축키를 즉시 등록한다 — 실패하면 이전 값을 유지하고 에러를 표시. */
  const applyShortcut = async (next: string) => {
    if (!next || next === shortcut) return
    const result = await window.clipboardAPI.setShortcut(next)
    if (!result.ok) {
      setError(result.error ?? '단축키를 등록할 수 없습니다.')
      return
    }
    setShortcut(next)
    setError('')
  }

  /** 녹화 모드 진입/종료 — main에 전역 단축키 일시 중단을 알린다. */
  const setRecordingMode = (active: boolean) => {
    setRecording(active)
    window.clipboardAPI.setRecording(active)
  }

  // 녹화 중 창이 닫히면 전역 단축키가 복원되도록 한다.
  useEffect(() => {
    return () => {
      window.clipboardAPI.setRecording(false)
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()

    // Escape는 변경 없이 녹화 취소.
    if (e.nativeEvent.code === 'Escape') {
      setRecordingMode(false)
      return
    }

    const accelerator = eventToAccelerator(e)
    if (accelerator) {
      setRecordingMode(false)
      void applyShortcut(accelerator)
    }
  }

  /** 모든 설정을 기본값으로 되돌린다(각 항목 즉시 적용). */
  const handleReset = () => {
    void applyShortcut(defaultShortcut)
    handleSelectQuickCopy(defaultQuickCopyModifier)
    if (hideOnBlur !== defaultHideOnBlur) handleToggleHideOnBlur()
    if (launchAtLogin !== defaultLaunchAtLogin) handleToggleLaunchAtLogin()
    handleSelectTheme(defaultTheme)
    handleSelectRetention(defaultRetentionDays)
    handleSelectMaxItems(defaultMaxItems)
    setError('')
  }

  return (
    <div className="flex h-full flex-col bg-white p-6 text-gray-900 dark:bg-ink dark:text-gray-100">
      <h1 className="text-lg font-bold">설정</h1>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">오버레이 열기와 빠른 복사 단축키를 변경합니다.</p>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">테마</label>

          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
            {THEME_OPTIONS.map((option) => {
              const active = theme === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelectTheme(option.value)}
                  className={[
                    'flex-1 rounded-lg py-2 text-sm font-semibold transition',
                    active
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            시스템을 선택하면 운영체제의 라이트/다크 설정을 따릅니다.
          </p>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">열기 단축키</label>

          <button
            onClick={() => {
              setRecordingMode(true)
              setError('')
            }}
            onBlur={() => recording && setRecordingMode(false)}
            onKeyDown={handleKeyDown}
            className={[
              'flex h-12 w-full items-center justify-center rounded-xl border text-base font-semibold tracking-wide transition focus:outline-none',
              recording
                ? 'border-toss-blue/60 bg-toss-blue/10 text-toss-blue'
                : 'border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10',
            ].join(' ')}
          >
            {recording ? '키를 누르세요…' : shortcut ? prettyAccelerator(shortcut) : '설정되지 않음'}
          </button>

          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            버튼을 클릭한 뒤 원하는 조합(예: Ctrl + Shift + V)을 누르세요. 최소 하나의 보조키(Ctrl/Alt/Shift)가
            필요합니다. Esc로 취소.
          </p>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">빠른 복사 단축키</label>

          <div className="grid grid-cols-3 gap-2">
            {QUICK_COPY_OPTIONS.map((modifier) => {
              const active = quickCopyModifier === modifier
              return (
                <button
                  key={modifier}
                  onClick={() => handleSelectQuickCopy(modifier)}
                  className={[
                    'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                    active
                      ? 'border-toss-blue/60 bg-toss-blue/10 text-toss-blue'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100',
                  ].join(' ')}
                >
                  {prettyQuickCopyModifier(modifier)} + 숫자
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            선택한 보조키와 1~9, 0을 눌러 현재 보이는 순서의 항목을 복사합니다. 0은 10번째 항목입니다.
          </p>
        </div>

        <div className="mt-6 pb-1">
          <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">창 동작</label>

          <button
            type="button"
            onClick={handleToggleHideOnBlur}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">포커스를 잃으면 자동으로 닫기</span>
              <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
                끄면 X 버튼이나 열기 단축키를 다시 눌러야 창이 닫힙니다.
              </span>
            </span>
            <span
              className={[
                'ml-4 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition',
                hideOnBlur ? 'bg-toss-blue' : 'bg-gray-300 dark:bg-white/15',
              ].join(' ')}
            >
              <span
                className={[
                  'h-5 w-5 rounded-full bg-white transition',
                  hideOnBlur ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleLaunchAtLogin}
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">로그인 시 자동 실행</span>
              <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
                컴퓨터를 켜면 앱을 백그라운드에서 바로 실행합니다.
              </span>
            </span>
            <span
              className={[
                'ml-4 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition',
                launchAtLogin ? 'bg-toss-blue' : 'bg-gray-300 dark:bg-white/15',
              ].join(' ')}
            >
              <span
                className={[
                  'h-5 w-5 rounded-full bg-white transition',
                  launchAtLogin ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>
        </div>

        <div className="mt-6 pb-1">
          <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">저장 관리</label>

          <p className="mb-2 text-[12px] font-medium text-gray-600 dark:text-gray-300">보관 기간</p>
          <div className="grid grid-cols-4 gap-2">
            {RETENTION_OPTIONS.map((option) => {
              const active = retentionDays === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelectRetention(option.value)}
                  className={[
                    'rounded-lg border px-2 py-2 text-sm font-semibold transition',
                    active
                      ? 'border-toss-blue/60 bg-toss-blue/10 text-toss-blue'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <p className="mb-2 mt-4 text-[12px] font-medium text-gray-600 dark:text-gray-300">최대 항목 수</p>
          <div className="grid grid-cols-4 gap-2">
            {MAX_ITEMS_OPTIONS.map((option) => {
              const active = maxItems === option.value
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelectMaxItems(option.value)}
                  className={[
                    'rounded-lg border px-2 py-2 text-sm font-semibold transition',
                    active
                      ? 'border-toss-blue/60 bg-toss-blue/10 text-toss-blue'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            기준을 넘은 오래된 항목을 자동으로 삭제합니다. 고정(📌)한 항목은 삭제되지 않습니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between pt-4">
        <button
          onClick={handleReset}
          className="rounded-lg px-3 py-2 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
        >
          기본값으로
        </button>

        <button
          onClick={() => window.clipboardAPI.closeSelf()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
