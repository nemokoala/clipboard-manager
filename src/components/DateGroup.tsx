import type { ReactNode } from 'react'

interface DateGroupProps {
  label: string
  children: ReactNode
}

export default function DateGroup({ label, children }: DateGroupProps) {
  return (
    <div className="mb-2">
      <h2 className="px-4 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
        {label}
      </h2>
      <div className="flex flex-col gap-1.5 px-3">{children}</div>
    </div>
  )
}
