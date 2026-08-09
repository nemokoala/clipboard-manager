import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureDisplayData, CaptureRect } from '../types'

interface Point {
  x: number
  y: number
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

type Adjustment =
  | { kind: 'move'; origin: Point; initial: CaptureRect }
  | {
      kind: 'resize'
      handle: ResizeHandle
      origin: Point
      initial: CaptureRect
    }

const EMPTY_RECT: CaptureRect = { x: 0, y: 0, width: 0, height: 0 }

const RESIZE_HANDLES: Array<{
  handle: ResizeHandle
  position: string
  cursor: string
}> = [
  {
    handle: 'nw',
    position: '-left-1.5 -top-1.5',
    cursor: 'cursor-nwse-resize',
  },
  {
    handle: 'n',
    position: '-top-1.5 left-1/2 -translate-x-1/2',
    cursor: 'cursor-ns-resize',
  },
  {
    handle: 'ne',
    position: '-right-1.5 -top-1.5',
    cursor: 'cursor-nesw-resize',
  },
  {
    handle: 'e',
    position: '-right-1.5 top-1/2 -translate-y-1/2',
    cursor: 'cursor-ew-resize',
  },
  {
    handle: 'se',
    position: '-bottom-1.5 -right-1.5',
    cursor: 'cursor-nwse-resize',
  },
  {
    handle: 's',
    position: '-bottom-1.5 left-1/2 -translate-x-1/2',
    cursor: 'cursor-ns-resize',
  },
  {
    handle: 'sw',
    position: '-bottom-1.5 -left-1.5',
    cursor: 'cursor-nesw-resize',
  },
  {
    handle: 'w',
    position: '-left-1.5 top-1/2 -translate-y-1/2',
    cursor: 'cursor-ew-resize',
  },
]

export default function CaptureOverlay() {
  const [display, setDisplay] = useState<CaptureDisplayData | null>(null)
  const [selection, setSelection] = useState<CaptureRect>(EMPTY_RECT)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [selectionLocked, setSelectionLocked] = useState(false)
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null)
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 })
  const requestId = useRef(0)

  useEffect(() => {
    window.clipboardAPI.onCaptureReady((data) => {
      setDisplay(data)
      setSelection({ x: 0, y: 0, width: data.width, height: data.height })
      setSelectionLocked(false)
    })
    return () => window.clipboardAPI.removeCaptureReadyListener()
  }, [])

  const complete = useCallback(
    (rect = selection, quickCopy = false) => {
      if (!display || rect.width < 2 || rect.height < 2) return
      void window.clipboardAPI.completeCapture(
        display.displayId,
        rect,
        quickCopy,
      )
    },
    [display, selection],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void window.clipboardAPI.cancelCapture()
      } else if (event.key === 'Enter') {
        complete()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [complete])

  const updateAutoRegion = (point: Point) => {
    if (!display || selectionLocked) return
    const currentRequest = ++requestId.current
    void window.clipboardAPI
      .getCaptureRegion(display.displayId, point.x, point.y)
      .then((rect) => {
        if (
          currentRequest === requestId.current &&
          !dragStart &&
          !selectionLocked
        )
          setSelection(rect)
      })
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const point = { x: event.clientX, y: event.clientY }
    setPointer(point)

    if (adjustment && display) {
      setSelection(adjustRect(adjustment, point, display.width, display.height))
      return
    }

    if (dragStart) {
      requestId.current += 1
      setSelection(rectFromPoints(dragStart, point))
      return
    }
    if (selectionLocked) return
    updateAutoRegion(point)
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    const point = { x: event.clientX, y: event.clientY }
    requestId.current += 1
    setSelectionLocked(false)
    setDragStart(point)
    setPointer(point)
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event: React.PointerEvent) => {
    const quickCopy = event.ctrlKey
    if (adjustment) {
      if (display && quickCopy) {
        const adjusted = adjustRect(
          adjustment,
          { x: event.clientX, y: event.clientY },
          display.width,
          display.height,
        )
        complete(adjusted, true)
        return
      }
      setAdjustment(null)
      setSelectionLocked(true)
      return
    }
    if (!dragStart) return
    const rect = rectFromPoints(dragStart, {
      x: event.clientX,
      y: event.clientY,
    })
    setDragStart(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    // 클릭이면 감지한 창을, 드래그면 직접 지정한 영역을 고정한다.
    if (rect.width < 4 && rect.height < 4) {
      const point = { x: event.clientX, y: event.clientY }
      if (display) {
        void window.clipboardAPI
          .getCaptureRegion(display.displayId, point.x, point.y)
          .then((autoRect) => {
            if (quickCopy) complete(autoRect, true)
            else {
              setSelection(autoRect)
              setSelectionLocked(true)
            }
          })
      }
      return
    }
    if (quickCopy) complete(rect, true)
    else {
      setSelection(rect)
      setSelectionLocked(true)
    }
  }

  const beginAdjustment = (
    event: React.PointerEvent,
    kind: 'move' | 'resize',
    handle?: ResizeHandle,
  ) => {
    if (!selectionLocked) return
    event.preventDefault()
    event.stopPropagation()
    requestId.current += 1
    const origin = { x: event.clientX, y: event.clientY }
    setPointer(origin)
    setAdjustment(
      kind === 'move'
        ? { kind: 'move', origin, initial: selection }
        : {
            kind: 'resize',
            handle: handle ?? 'se',
            origin,
            initial: selection,
          },
    )
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  if (!display) return <div className="h-full bg-black" />

  const labelTop = selection.y > 46
  const activelyAdjusting = dragStart !== null || adjustment !== null
  const sizeLeft = Math.max(8, selection.x)
  const sizeTop = labelTop
    ? selection.y - 34
    : Math.min(display.height - 32, selection.y + selection.height + 8)

  return (
    <main
      className="capture-canvas relative h-full w-full cursor-crosshair overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: `url(${display.screenshot})`,
        backgroundSize: '100% 100%',
      }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="capture-hint pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/65 px-4 py-2 text-[12px] font-medium tracking-[-0.01em] text-white shadow-lg backdrop-blur-md">
        창을 클릭하거나 원하는 영역을 드래그하세요
      </div>

      <DimmedArea
        rect={selection}
        width={display.width}
        height={display.height}
        dragging={activelyAdjusting}
      />

      {selection.width > 0 && selection.height > 0 && (
        <>
          <svg
            className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
            aria-hidden="true"
          >
            <rect
              x={selection.x + 1.5}
              y={selection.y + 1.5}
              width={Math.max(0, selection.width - 3)}
              height={Math.max(0, selection.height - 3)}
              fill="rgba(49, 130, 246, 0.08)"
              stroke="rgba(255, 255, 255, 0.98)"
              strokeWidth="3"
            />
            <rect
              x={selection.x + 1.5}
              y={selection.y + 1.5}
              width={Math.max(0, selection.width - 3)}
              height={Math.max(0, selection.height - 3)}
              fill="none"
              stroke="#3182F6"
              strokeWidth="1.5"
            />
          </svg>
          <div
            className={[
              'absolute z-20 shadow-[0_0_16px_rgba(49,130,246,0.4)]',
              activelyAdjusting
                ? 'capture-selection-dragging'
                : 'capture-selection',
              selectionLocked
                ? 'pointer-events-auto cursor-move'
                : 'pointer-events-none',
            ].join(' ')}
            style={rectStyle(selection)}
            onPointerDown={(event) => beginAdjustment(event, 'move')}
          >
            {RESIZE_HANDLES.map(({ handle, position, cursor }) => (
              <span
                key={handle}
                className={`absolute h-2.5 w-2.5 rounded-full border border-toss-blue bg-white shadow-md ${position} ${cursor}`}
                onPointerDown={(event) =>
                  beginAdjustment(event, 'resize', handle)
                }
              />
            ))}
          </div>
          {!activelyAdjusting && (
            <div
              className="capture-size pointer-events-none absolute z-30 rounded-md border border-white/20 bg-toss-blue px-2.5 py-1.5 font-mono text-[11px] font-semibold tabular-nums text-white shadow-[0_6px_20px_rgba(0,0,0,0.32)]"
              style={{ left: sizeLeft, top: sizeTop }}
            >
              {Math.round(selection.width)} × {Math.round(selection.height)}
            </div>
          )}
        </>
      )}

      {activelyAdjusting && (
        <CaptureMagnifier
          display={display}
          pointer={pointer}
          selection={selection}
        />
      )}

      <div
        className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/70 p-1.5 pl-4 text-[11px] text-white/75 shadow-xl backdrop-blur-md"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="mr-1">
          {selectionLocked
            ? '영역을 이동하거나 핸들로 조절하세요'
            : '드래그해서 영역 선택'}
        </span>
        <span className="mr-1 hidden text-white/45 sm:inline">
          <kbd>Ctrl</kbd> + 드래그 즉시 복사
        </span>
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-white/75 transition hover:bg-white/10 hover:text-white"
          onClick={() => void window.clipboardAPI.cancelCapture()}
        >
          취소 <kbd>Esc</kbd>
        </button>
        <button
          type="button"
          disabled={!selectionLocked}
          className="rounded-full bg-toss-blue px-3.5 py-1.5 font-semibold text-white transition hover:bg-toss-bluehover disabled:cursor-default disabled:opacity-40"
          onClick={() => complete()}
        >
          캡처 <kbd>Enter</kbd>
        </button>
      </div>
    </main>
  )
}

function CaptureMagnifier({
  display,
  pointer,
  selection,
}: {
  display: CaptureDisplayData
  pointer: Point
  selection: CaptureRect
}) {
  const size = 144
  const zoom = 2
  const gap = 24
  const left = clamp(
    pointer.x + gap + size > display.width
      ? pointer.x - gap - size
      : pointer.x + gap,
    8,
    display.width - size - 8,
  )
  const top = clamp(
    pointer.y + gap + size > display.height
      ? pointer.y - gap - size
      : pointer.y + gap,
    8,
    display.height - size - 8,
  )

  return (
    <div
      className="capture-magnifier pointer-events-none absolute z-40 overflow-hidden rounded-full border border-white/90 bg-black shadow-[0_10px_32px_rgba(0,0,0,0.48),0_0_0_2px_rgba(49,130,246,0.8)]"
      style={{ left, top, width: size, height: size }}
    >
      <img
        src={display.screenshot}
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{
          width: display.width * zoom,
          height: display.height * zoom,
          maxWidth: 'none',
          left: size / 2 - pointer.x * zoom,
          top: size / 2 - pointer.y * zoom,
        }}
      />
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/65 shadow-[0_0_0_1px_rgba(49,130,246,0.7)]" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/65 shadow-[0_0_0_1px_rgba(49,130,246,0.7)]" />
      <span className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 text-center font-mono text-[9px] tabular-nums text-white backdrop-blur-sm">
        {Math.round(selection.width)} × {Math.round(selection.height)} ·{' '}
        {Math.round(pointer.x)}, {Math.round(pointer.y)}
      </span>
    </div>
  )
}

function DimmedArea({
  rect,
  width,
  height,
  dragging,
}: {
  rect: CaptureRect
  width: number
  height: number
  dragging: boolean
}) {
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height
  const shared = [
    'pointer-events-none absolute z-10 bg-black/70',
    dragging ? '' : 'transition-[left,top,width,height] duration-75 ease-out',
  ].join(' ')
  return (
    <>
      <div
        className={shared}
        style={{ left: 0, top: 0, width, height: rect.y }}
      />
      <div
        className={shared}
        style={{
          left: 0,
          top: bottom,
          width,
          height: Math.max(0, height - bottom),
        }}
      />
      <div
        className={shared}
        style={{ left: 0, top: rect.y, width: rect.x, height: rect.height }}
      />
      <div
        className={shared}
        style={{
          left: right,
          top: rect.y,
          width: Math.max(0, width - right),
          height: rect.height,
        }}
      />
    </>
  )
}

function rectFromPoints(start: Point, end: Point): CaptureRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

function adjustRect(
  adjustment: Adjustment,
  point: Point,
  maxWidth: number,
  maxHeight: number,
): CaptureRect {
  const deltaX = point.x - adjustment.origin.x
  const deltaY = point.y - adjustment.origin.y
  const initial = adjustment.initial

  if (adjustment.kind === 'move') {
    return {
      ...initial,
      x: clamp(initial.x + deltaX, 0, maxWidth - initial.width),
      y: clamp(initial.y + deltaY, 0, maxHeight - initial.height),
    }
  }

  const minimumSize = 24
  let left = initial.x
  let top = initial.y
  let right = initial.x + initial.width
  let bottom = initial.y + initial.height

  if (adjustment.handle.includes('w')) {
    left = clamp(initial.x + deltaX, 0, right - minimumSize)
  }
  if (adjustment.handle.includes('e')) {
    right = clamp(
      initial.x + initial.width + deltaX,
      left + minimumSize,
      maxWidth,
    )
  }
  if (adjustment.handle.includes('n')) {
    top = clamp(initial.y + deltaY, 0, bottom - minimumSize)
  }
  if (adjustment.handle.includes('s')) {
    bottom = clamp(
      initial.y + initial.height + deltaY,
      top + minimumSize,
      maxHeight,
    )
  }

  return { x: left, y: top, width: right - left, height: bottom - top }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function rectStyle(rect: CaptureRect) {
  return {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  }
}
