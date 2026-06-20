import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Settings from './components/Settings'
import Toast from './components/Toast'
import { initTheme, setTheme } from './utils/theme'
import './index.css'

// 깜빡임 최소화: 우선 시스템 테마로 즉시 적용한 뒤 저장된 설정으로 보정한다.
initTheme('system')
void window.clipboardAPI.getSettings().then((s) => setTheme(s.theme))
// 다른 창에서의 테마 변경/시스템 전환을 실시간 반영한다.
window.clipboardAPI.onThemeChanged((theme) => setTheme(theme))

// 보조 창은 같은 번들을 URL hash로 구분해 렌더링한다.
const route = window.location.hash.replace(/^#/, '')
const content = route.startsWith('settings') ? (
  <Settings />
) : route.startsWith('toast') ? (
  <Toast />
) : (
  <App />
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{content}</React.StrictMode>,
)
