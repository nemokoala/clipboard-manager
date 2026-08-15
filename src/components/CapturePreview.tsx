import { useCallback, useEffect, useState } from 'react'
import type { CapturePreviewData } from '../types'

type Status = 'copied' | 'saved' | 'idle'

export default function CapturePreview() {
  const [preview, setPreview] = useState<CapturePreviewData | null>(null)
  const [status, setStatus] = useState<Status>('copied')
  const [pixelRatio, setPixelRatio] = useState(window.devicePixelRatio)

  useEffect(() => {
    window.clipboardAPI.onCapturePreview(setPreview)
    return () => window.clipboardAPI.removeCapturePreviewListener()
  }, [])

  // 창을 배율이 다른 모니터로 옮기면 devicePixelRatio 가 바뀐다. 그대로 두면
  // 1:1 로 맞춰 둔 크기가 어긋나 다시 흐려지므로 resize 때마다 갱신한다.
  useEffect(() => {
    const onResize = () => setPixelRatio(window.devicePixelRatio)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const copy = useCallback(async () => {
    if (await window.clipboardAPI.copyCapturePreview()) setStatus('copied')
  }, [])

  const save = useCallback(async () => {
    if (await window.clipboardAPI.saveCapturePreview()) setStatus('saved')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void window.clipboardAPI.closeCapturePreview()
        return
      }
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void copy()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [copy, save])

  return (
    <main className="capture-preview flex h-full flex-col overflow-hidden bg-[#15171A] text-white">
      <header className="drag-region flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div>
          <h1 className="text-[13px] font-semibold tracking-[-0.01em]">
            캡처 미리보기
          </h1>
          <p className="mt-0.5 text-[10px] tabular-nums text-white/45">
            {preview
              ? `${preview.width} × ${preview.height} PNG`
              : '불러오는 중'}
          </p>
        </div>
        <button
          type="button"
          aria-label="닫기"
          className="no-drag grid h-8 w-8 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
          onClick={() => void window.clipboardAPI.closeCapturePreview()}
        >
          <CloseIcon />
        </button>
      </header>

      <section className="relative min-h-0 flex-1 overflow-hidden bg-[#0D0F11] p-5">
        <div className="preview-grid absolute inset-0 opacity-35" />
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
          {preview ? (
            <img
              src={preview.dataUrl}
              alt="캡처 결과"
              draggable={false}
              className="capture-preview-image object-contain shadow-[0_18px_60px_rgba(0,0,0,0.42)]"
              // 이미지의 기본 크기는 "픽셀 수 = CSS px" 로 잡히므로, 배율이 걸린
              // 화면에서는 그대로 두면 devicePixelRatio 배로 확대돼 흐려진다
              // (175% 에서 875px 이미지가 1531 물리픽셀로 그려짐 · 선명도 1/35).
              // 상한을 `픽셀 수 ÷ devicePixelRatio` 로 걸어 1:1 을 넘겨 확대되지 않게 하고,
              // 창보다 크면 100% 쪽이 이겨 축소된다(축소는 선명함이 유지된다).
              // width/height 를 직접 지정하면 두 축의 상한이 따로 걸려 비율이 깨지므로
              // 반드시 max-* 만 준다. 나머지는 브라우저가 비율을 지켜 맞춘다.
              style={{
                maxWidth: `min(100%, ${preview.width / pixelRatio}px)`,
                maxHeight: `min(100%, ${preview.height / pixelRatio}px)`,
              }}
            />
          ) : (
            <div className="h-5 w-5 animate-pulse rounded-full bg-white/20" />
          )}
        </div>
      </section>

      <footer className="flex h-[72px] shrink-0 items-center justify-between border-t border-white/10 px-5">
        <p className="text-[11px] text-white/50">
          {status === 'saved'
            ? 'PNG 파일로 저장했습니다'
            : status === 'copied'
              ? '클립보드에 복사되었습니다'
              : '캡처가 준비되었습니다'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={() => void copy()}
          >
            <CopyIcon />
            복사
          </button>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-lg bg-toss-blue px-4 text-[12px] font-semibold text-white transition hover:bg-toss-bluehover"
            onClick={() => void save()}
          >
            <SaveIcon />
            PNG 저장
          </button>
        </div>
      </footer>
    </main>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect
        x="5.25"
        y="5.25"
        width="7.5"
        height="7.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.25 10.5h-.5A1.5 1.5 0 011.25 9V2.75a1.5 1.5 0 011.5-1.5H9a1.5 1.5 0 011.5 1.5v.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.75v8.5m0 0l-3-3m3 3l3-3M2.25 11.25v1.5a1 1 0 001 1h9.5a1 1 0 001-1v-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
