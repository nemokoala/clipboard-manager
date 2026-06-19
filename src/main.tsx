import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Settings from './components/Settings'
import Toast from './components/Toast'
import './index.css'

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
