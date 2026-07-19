# Assets

앱 아이콘은 `icon.svg` 하나가 원본이고, 배포용 파일은 여기서 생성한다.

```bash
node assets/generate-icons.mjs   # icon.svg → icon.png / icon.icns / icon.ico
```

생성 스크립트는 Electron 을 오프스크린으로 띄워 SVG 를 크기별로 직접 그린다
(별도 이미지 도구가 필요 없다). 크기마다 새로 그리므로 16px 도 뭉개지지 않는다.
`icon.icns` 는 `iconutil` 이 있는 macOS 에서만 만들어진다.

| 파일               | 쓰임                                                     |
| ------------------ | -------------------------------------------------------- |
| `icon.svg`         | 원본. 디자인은 여기서만 고친다.                          |
| `icon.icns`        | macOS 앱 아이콘 (`electron-builder.yml` 의 `mac.icon`)   |
| `icon.ico`         | Windows 앱 아이콘 + 트레이 아이콘                        |
| `icon.png`         | 1024px. Linux / 일반 용도                                |
| `iconTemplate.png` | macOS 트레이 아이콘 (단색 template, `@2x` 변형과 함께)   |

트레이는 이 파일들이 없어도 투명 대체 아이콘으로 동작하므로, 아이콘 없이도 개발은
가능하다.
