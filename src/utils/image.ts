const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

/**
 * PNG data URL 의 헤더(IHDR)에서 픽셀 크기를 읽는다. PNG 가 아니거나 헤더가 깨졌으면 null.
 *
 * 이미지를 디코딩하지 않고 base64 앞 32자(= 24바이트: 시그니처 8 + 청크 길이 4 +
 * "IHDR" 4 + 너비 4 + 높이 4)만 풀기 때문에 비용이 거의 없다.
 * 가상 스크롤 행이 이미지 로드 전에 최종 크기의 자리를 잡아 두는 데 쓴다.
 */
export function pngDataUrlSize(
  dataUrl: string,
): { width: number; height: number } | null {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return null

  let bytes: string
  try {
    const start = PNG_DATA_URL_PREFIX.length
    bytes = atob(dataUrl.slice(start, start + 32))
  } catch {
    return null
  }
  if (bytes.length < 24 || bytes.slice(12, 16) !== 'IHDR') return null

  // 빅엔디언 32비트 정수. >>> 0 으로 부호 없는 값으로 만든다.
  const readUint32 = (offset: number) =>
    ((bytes.charCodeAt(offset) << 24) |
      (bytes.charCodeAt(offset + 1) << 16) |
      (bytes.charCodeAt(offset + 2) << 8) |
      bytes.charCodeAt(offset + 3)) >>>
    0

  const width = readUint32(16)
  const height = readUint32(20)
  return width > 0 && height > 0 ? { width, height } : null
}
