import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Settings from './components/Settings'
import './index.css'

// The settings window loads the same bundle with a `#settings` hash.
const isSettings = window.location.hash.replace(/^#/, '').startsWith('settings')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isSettings ? <Settings /> : <App />}</React.StrictMode>,
)
