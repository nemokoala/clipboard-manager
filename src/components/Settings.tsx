import { useEffect, useState, type ReactNode } from 'react'
import type { QuickCopyModifier, SettingsData, ThemeMode } from '../types'
import {
  eventToAccelerator,
  modifierLabel,
  prettyAccelerator,
} from '../utils/accelerator'
import { setTheme as applyTheme } from '../utils/theme'
import OptionGrid from './ui/OptionGrid'
import SegmentedControl, { type Option } from './ui/SegmentedControl'
import Toggle from './ui/Toggle'

const THEME_OPTIONS: Option<ThemeMode>[] = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템' },
]

const QUICK_COPY_OPTIONS: Option<QuickCopyModifier>[] = (
  ['primary', 'alt', 'shift'] as const
).map((modifier) => ({
  value: modifier,
  label: `${modifierLabel(modifier)} + 숫자`,
}))

// 자동 정리 옵션(0 = 제한 없음). 고정한 항목은 정리에서 제외된다.
const RETENTION_OPTIONS: Option<number>[] = [
  { value: 0, label: '무제한' },
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
]

const MAX_ITEMS_OPTIONS: Option<number>[] = [
  { value: 0, label: '무제한' },
  { value: 100, label: '100개' },
  { value: 500, label: '500개' },
  { value: 1000, label: '1000개' },
]

/** 제목 + 컨트롤 + 보조 설명으로 이뤄진 설정 한 칸. */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {label}
      </h2>
      {children}
      {hint && (
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          {hint}
        </p>
      )}
    </section>
  )
}

export default function Settings() {
  // 모든 설정은 변경 즉시 적용·저장한다(저장 버튼 없음).
  // 현재 값과 기본값을 한 객체로 함께 들고 있어 "기본값으로" 버튼이 단순해진다.
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [recording, setRecording] = useState(false)
  // 단축키 등록 실패 시에만 표시하는 에러 메시지.
  const [error, setError] = useState('')

  useEffect(() => {
    void window.clipboardAPI.getSettings().then(setSettings)
  }, [])

  // 녹화 도중 창이 닫혀도 전역 단축키가 해제된 채로 남지 않게 한다.
  useEffect(() => {
    return () => {
      void window.clipboardAPI.setRecording(false)
    }
  }, [])

  /** 저장은 메인 프로세스가 하고, 화면 상태는 즉시 반영한다. */
  function patch<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const selectTheme = (theme: ThemeMode) => {
    patch('theme', theme)
    applyTheme(theme) // 설정 창 자신에게 먼저 반영(다른 창은 main 이 브로드캐스트)
    void window.clipboardAPI.setTheme(theme)
  }

  const selectQuickCopy = (modifier: QuickCopyModifier) => {
    patch('quickCopyModifier', modifier)
    void window.clipboardAPI.setQuickCopyModifier(modifier)
  }

  const selectRetention = (days: number) => {
    patch('retentionDays', days)
    void window.clipboardAPI.setRetentionDays(days)
  }

  const selectMaxItems = (max: number) => {
    patch('maxItems', max)
    void window.clipboardAPI.setMaxItems(max)
  }

  const toggleHideOnBlur = (next: boolean) => {
    patch('hideOnBlur', next)
    void window.clipboardAPI.setHideOnBlur(next)
  }

  const toggleLaunchAtLogin = (next: boolean) => {
    patch('launchAtLogin', next)
    void window.clipboardAPI.setLaunchAtLogin(next)
  }

  /** 단축키는 OS 등록이 거부될 수 있어, 성공했을 때만 화면 값을 바꾼다. */
  const applyShortcut = async (next: string) => {
    if (!settings || !next || next === settings.shortcut) return

    const result = await window.clipboardAPI.setShortcut(next)
    if (!result.ok) {
      setError(result.error ?? '단축키를 등록할 수 없습니다.')
      return
    }
    patch('shortcut', next)
    setError('')
  }

  /** 녹화 모드 진입/종료 — main 에 전역 단축키 일시 중단을 알린다. */
  const setRecordingMode = (active: boolean) => {
    setRecording(active)
    void window.clipboardAPI.setRecording(active)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()

    // Escape 는 변경 없이 녹화만 취소.
    if (e.nativeEvent.code === 'Escape') {
      setRecordingMode(false)
      return
    }

    const accelerator = eventToAccelerator(e.nativeEvent)
    if (accelerator) {
      setRecordingMode(false)
      void applyShortcut(accelerator)
    }
  }

  /** 모든 설정을 기본값으로 되돌린다(각 항목 즉시 적용). */
  const handleReset = () => {
    if (!settings) return
    void applyShortcut(settings.defaultShortcut)
    selectQuickCopy(settings.defaultQuickCopyModifier)
    toggleHideOnBlur(settings.defaultHideOnBlur)
    toggleLaunchAtLogin(settings.defaultLaunchAtLogin)
    selectTheme(settings.defaultTheme)
    selectRetention(settings.defaultRetentionDays)
    selectMaxItems(settings.defaultMaxItems)
    setError('')
  }

  // 설정을 읽어오기 전에는 배경만 그린다(창 배경색과 같아 깜빡임이 없다).
  if (!settings) {
    return <div className="h-full bg-white dark:bg-ink" />
  }

  return (
    <div className="flex h-full flex-col bg-white p-6 text-gray-900 dark:bg-ink dark:text-gray-100">
      <h1 className="text-lg font-bold">설정</h1>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        오버레이 열기와 빠른 복사 단축키를 변경합니다.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <Field
          label="테마"
          hint="시스템을 선택하면 운영체제의 라이트/다크 설정을 따릅니다."
        >
          <SegmentedControl
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={selectTheme}
          />
        </Field>

        <Field
          label="열기 단축키"
          hint="버튼을 클릭한 뒤 원하는 조합(예: Ctrl + Shift + V)을 누르세요. 최소 하나의 보조키(Ctrl/Alt/Shift)가 필요합니다. Esc로 취소."
        >
          <button
            type="button"
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
            {recording
              ? '키를 누르세요…'
              : settings.shortcut
                ? prettyAccelerator(settings.shortcut)
                : '설정되지 않음'}
          </button>
        </Field>

        <Field
          label="빠른 복사 단축키"
          hint="선택한 보조키와 1~9, 0을 눌러 현재 보이는 순서의 항목을 복사합니다. 0은 10번째 항목입니다."
        >
          <OptionGrid
            options={QUICK_COPY_OPTIONS}
            value={settings.quickCopyModifier}
            columns={3}
            onChange={selectQuickCopy}
          />
        </Field>

        <Field label="창 동작">
          <Toggle
            label="포커스를 잃으면 자동으로 닫기"
            description="끄면 X 버튼이나 열기 단축키를 다시 눌러야 창이 닫힙니다."
            checked={settings.hideOnBlur}
            onChange={toggleHideOnBlur}
          />
          <div className="mt-2">
            <Toggle
              label="로그인 시 자동 실행"
              description="컴퓨터를 켜면 앱을 백그라운드에서 바로 실행합니다."
              checked={settings.launchAtLogin}
              onChange={toggleLaunchAtLogin}
            />
          </div>
        </Field>

        <Field
          label="저장 관리"
          hint="기준을 넘은 오래된 항목을 자동으로 삭제합니다. 고정(📌)한 항목은 삭제되지 않습니다."
        >
          <p className="mb-2 text-[12px] font-medium text-gray-600 dark:text-gray-300">
            보관 기간
          </p>
          <OptionGrid
            options={RETENTION_OPTIONS}
            value={settings.retentionDays}
            columns={4}
            onChange={selectRetention}
          />

          <p className="mb-2 mt-4 text-[12px] font-medium text-gray-600 dark:text-gray-300">
            최대 항목 수
          </p>
          <OptionGrid
            options={MAX_ITEMS_OPTIONS}
            value={settings.maxItems}
            columns={4}
            onChange={selectMaxItems}
          />
        </Field>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between pt-4">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg px-3 py-2 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
        >
          기본값으로
        </button>

        <button
          type="button"
          onClick={() => window.clipboardAPI.closeSelf()}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
