import { useEffect, useState } from 'react'

const IS_MAC = navigator.userAgent.includes('Mac')

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

export default function Settings() {
  const [saved, setSaved] = useState('')
  const [defaultShortcut, setDefaultShortcut] = useState('')
  const [draft, setDraft] = useState('')
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    window.clipboardAPI.getSettings().then((s) => {
      setSaved(s.shortcut)
      setDraft(s.shortcut)
      setDefaultShortcut(s.defaultShortcut)
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
    if (!draft || draft === saved) return
    const result = await window.clipboardAPI.setShortcut(draft)
    if (result.ok) {
      setSaved(draft)
      setMessage({ kind: 'ok', text: '단축키가 저장되었습니다.' })
    } else {
      setDraft(saved)
      setMessage({ kind: 'err', text: result.error ?? '저장에 실패했습니다.' })
    }
  }

  const handleReset = () => {
    setDraft(defaultShortcut)
    setMessage(null)
  }

  const dirty = draft !== saved

  return (
    <div className="flex h-full flex-col bg-neutral-900 p-6 text-white/90">
      <h1 className="text-lg font-semibold">설정</h1>
      <p className="mt-1 text-xs text-white/50">오버레이 창을 여는 전역 단축키를 변경합니다.</p>

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

      <div className="mt-auto flex items-center justify-between pt-6">
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
