import { useEffect, useState } from 'react'
import type { QuickCopyModifier } from '../types'
import { isMacLike } from '../utils/platform'

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

export default function Settings() {
  const [saved, setSaved] = useState('')
  const [defaultShortcut, setDefaultShortcut] = useState('')
  const [draft, setDraft] = useState('')
  const [savedQuickCopyModifier, setSavedQuickCopyModifier] =
    useState<QuickCopyModifier>('primary')
  const [defaultQuickCopyModifier, setDefaultQuickCopyModifier] =
    useState<QuickCopyModifier>('primary')
  const [draftQuickCopyModifier, setDraftQuickCopyModifier] =
    useState<QuickCopyModifier>('primary')
  const [savedHideOnBlur, setSavedHideOnBlur] = useState(true)
  const [defaultHideOnBlur, setDefaultHideOnBlur] = useState(true)
  const [draftHideOnBlur, setDraftHideOnBlur] = useState(true)
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    window.clipboardAPI.getSettings().then((s) => {
      setSaved(s.shortcut)
      setDraft(s.shortcut)
      setDefaultShortcut(s.defaultShortcut)
      setSavedQuickCopyModifier(s.quickCopyModifier)
      setDraftQuickCopyModifier(s.quickCopyModifier)
      setDefaultQuickCopyModifier(s.defaultQuickCopyModifier)
      setSavedHideOnBlur(s.hideOnBlur)
      setDraftHideOnBlur(s.hideOnBlur)
      setDefaultHideOnBlur(s.defaultHideOnBlur)
    })
  }, [])

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

    // Escape는 draft 변경 없이 녹화 취소.
    if (e.nativeEvent.code === 'Escape') {
      setRecordingMode(false)
      return
    }

    const accelerator = eventToAccelerator(e)
    if (accelerator) {
      setDraft(accelerator)
      setRecordingMode(false)
      setMessage(null)
    }
  }

  const handleSave = async () => {
    if (!draft) return

    if (draft !== saved) {
      const result = await window.clipboardAPI.setShortcut(draft)
      if (!result.ok) {
        setDraft(saved)
        setMessage({ kind: 'err', text: result.error ?? '저장에 실패했습니다.' })
        return
      }
      setSaved(draft)
    }

    if (draftQuickCopyModifier !== savedQuickCopyModifier) {
      await window.clipboardAPI.setQuickCopyModifier(draftQuickCopyModifier)
      setSavedQuickCopyModifier(draftQuickCopyModifier)
    }

    if (draftHideOnBlur !== savedHideOnBlur) {
      await window.clipboardAPI.setHideOnBlur(draftHideOnBlur)
      setSavedHideOnBlur(draftHideOnBlur)
    }

    if (
      draft !== saved ||
      draftQuickCopyModifier !== savedQuickCopyModifier ||
      draftHideOnBlur !== savedHideOnBlur
    ) {
      setMessage({ kind: 'ok', text: '설정이 저장되었습니다.' })
    }
  }

  const handleReset = () => {
    setDraft(defaultShortcut)
    setDraftQuickCopyModifier(defaultQuickCopyModifier)
    setDraftHideOnBlur(defaultHideOnBlur)
    setMessage(null)
  }

  const dirty =
    draft !== saved ||
    draftQuickCopyModifier !== savedQuickCopyModifier ||
    draftHideOnBlur !== savedHideOnBlur

  return (
    <div className="flex h-full flex-col bg-neutral-900 p-6 text-white/90">
      <h1 className="text-lg font-semibold">설정</h1>
      <p className="mt-1 text-xs text-white/50">오버레이 열기와 빠른 복사 단축키를 변경합니다.</p>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-white/80">열기 단축키</label>

          <button
            onClick={() => {
              setRecordingMode(true)
              setMessage(null)
            }}
            onBlur={() => recording && setRecordingMode(false)}
            onKeyDown={handleKeyDown}
            className={[
              'flex h-12 w-full items-center justify-center rounded-xl border text-base font-medium tracking-wide transition focus:outline-none',
              recording
                ? 'border-sky-400/60 bg-sky-400/10 text-sky-200'
                : 'border-white/10 bg-white/5 text-white/90 hover:bg-white/10',
            ].join(' ')}
          >
            {recording ? '키를 누르세요…' : draft ? prettyAccelerator(draft) : '설정되지 않음'}
          </button>

          <p className="mt-2 text-[11px] text-white/40">
            버튼을 클릭한 뒤 원하는 조합(예: Ctrl + Shift + V)을 누르세요. 최소 하나의 보조키(Ctrl/Alt/Shift)가
            필요합니다. Esc로 취소.
          </p>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-white/80">빠른 복사 단축키</label>

          <div className="grid grid-cols-3 gap-2">
            {QUICK_COPY_OPTIONS.map((modifier) => {
              const active = draftQuickCopyModifier === modifier
              return (
                <button
                  key={modifier}
                  onClick={() => {
                    setDraftQuickCopyModifier(modifier)
                    setMessage(null)
                  }}
                  className={[
                    'rounded-lg border px-3 py-2 text-sm font-medium transition',
                    active
                      ? 'border-sky-400/60 bg-sky-400/10 text-sky-200'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90',
                  ].join(' ')}
                >
                  {prettyQuickCopyModifier(modifier)} + 숫자
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-[11px] text-white/40">
            선택한 보조키와 1~9, 0을 눌러 현재 보이는 순서의 항목을 복사합니다. 0은 10번째 항목입니다.
          </p>
        </div>

        <div className="mt-6 pb-1">
          <label className="mb-2 block text-sm font-medium text-white/80">창 동작</label>

          <button
            type="button"
            onClick={() => {
              setDraftHideOnBlur((value) => !value)
              setMessage(null)
            }}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <span>
              <span className="block text-sm font-medium text-white/90">포커스를 잃으면 자동으로 닫기</span>
              <span className="mt-1 block text-[11px] text-white/40">
                끄면 X 버튼이나 열기 단축키를 다시 눌러야 창이 닫힙니다.
              </span>
            </span>
            <span
              className={[
                'ml-4 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition',
                draftHideOnBlur ? 'bg-sky-500' : 'bg-white/15',
              ].join(' ')}
            >
              <span
                className={[
                  'h-5 w-5 rounded-full bg-white transition',
                  draftHideOnBlur ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={[
            'mt-4 rounded-lg px-3 py-2 text-xs',
            message.kind === 'ok'
              ? 'bg-emerald-400/10 text-emerald-300'
              : 'bg-red-500/10 text-red-300',
          ].join(' ')}
        >
          {message.text}
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between pt-4">
        <button
          onClick={handleReset}
          className="rounded-lg px-3 py-2 text-xs text-white/50 transition hover:bg-white/5 hover:text-white/80"
        >
          기본값으로
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => window.clipboardAPI.closeSelf()}
            className="rounded-lg px-4 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white/90"
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={[
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              dirty
                ? 'bg-sky-500 text-white hover:bg-sky-400'
                : 'cursor-not-allowed bg-white/5 text-white/30',
            ].join(' ')}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
