import { nativeImage, type NativeImage } from 'electron'

// 목록의 미리보기는 최대 80px 높이, 패널 폭(약 420px) 안에서 그려진다.
// 레티나를 감안해 그 2배를 상한으로 잡는다.
const MAX_HEIGHT = 160
const MAX_WIDTH = 840

/**
 * 이미지의 축소본을 PNG data URL 로 만든다.
 *
 * 목록에 원본을 그대로 넘기면 80px 짜리 미리보기를 그리려고 수 MB 짜리 원본을
 * 통째로 디코딩하게 된다(18MB PNG → 수십 MB 비트맵). 캡처 시점에 한 번만 줄여두면
 * 그 비용이 사라지고, 렌더러로 넘어가는 IPC 페이로드도 함께 줄어든다.
 *
 * 가로·세로 상한을 모두 두고 비율은 유지한다. 높이만 제한하면 가로로 긴 이미지
 * (파노라마·와이드 스크린샷)가 원본 폭 그대로 남아 썸네일이 거의 안 줄어든다.
 */
export function makeThumbnail(image: NativeImage): string | null {
  if (image.isEmpty()) return null

  const { width, height } = image.getSize()
  if (width <= 0 || height <= 0) return null

  // 두 상한 중 더 빡빡한 쪽에 맞춘다. 1 을 넘지 않으므로 확대는 하지 않는다.
  const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1)

  const thumb =
    scale < 1
      ? image.resize({
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
          quality: 'good',
        })
      : image

  if (thumb.isEmpty()) return null
  return `data:image/png;base64,${thumb.toPNG().toString('base64')}`
}

/** 이미 저장된 data URL 원본에서 썸네일을 만든다 (기존 항목 백필용). */
export function makeThumbnailFromDataUrl(dataUrl: string): string | null {
  return makeThumbnail(nativeImage.createFromDataURL(dataUrl))
}
