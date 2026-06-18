import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Settings from './components/Settings'
import './index.css'

// 설정 창은 같은 번들을 `#settings` 해시로 로드한다.
const isSettings = window.location.hash.replace(/^#/, '').startsWith('settings')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isSettings ? <Settings /> : <App />}</React.StrictMode>,
)
