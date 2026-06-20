import { useEffect, useState } from 'react'

export default function Toast() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    window.clipboardAPI.onToast((nextMessage) => {
      if (hideTimer) clearTimeout(hideTimer)
      setMessage(nextMessage)
      setVisible(true)

      hideTimer = setTimeout(() => {
        setVisible(false)
        hideTimer = null
      }, 1200)
    })

    return () => {
      if (hideTimer) clearTimeout(hideTimer)
      window.clipboardAPI.removeToastListener()
    }
  }, [])

  return (
    <div className="flex h-full items-center justify-center bg-transparent px-2">
      <div
        className={[
          'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-900 shadow-lg opacity-0 transition-opacity duration-150 dark:border-white/10 dark:bg-ink dark:text-white',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {message}
      </div>
    </div>
  )
}
