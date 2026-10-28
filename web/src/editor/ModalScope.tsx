import { useLayoutEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'

export function ModalScope({ children, trigger, onCancel, busy }: {
  children: ReactNode; trigger: RefObject<HTMLElement | null>; onCancel: () => void; busy: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const previous = trigger.current
    return () => { queueMicrotask(() => {
      if (previous?.isConnected && !previous.matches(':disabled')) previous.focus()
      else document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"], .toolbar button')?.focus()
    }) }
  }, [])
  useLayoutEffect(() => {
    const host = root.current
    if (!host) return
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')
    const controls = () => Array.from(host.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, [tabindex="0"]',
    )).filter(element => !element.matches(':disabled'))
    if (dialog) {
      dialog.tabIndex = -1
      if (!dialog.contains(document.activeElement)) (controls()[0] ?? dialog).focus()
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation()
        if (!busy && !host.querySelector('[aria-busy="true"]')) onCancel()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); event.stopImmediatePropagation()
      } else if (event.key === 'Tab') {
        const items = controls()
        const index = items.indexOf(document.activeElement as HTMLElement)
        const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length
        event.preventDefault(); event.stopImmediatePropagation()
        ;(items[next] ?? dialog)?.focus()
      }
    }
    const focus = (event: FocusEvent) => {
      if (!host.contains(event.target as Node)) (controls()[0] ?? dialog)?.focus()
    }
    window.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focus)
    return () => {
      window.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focus)
    }
  }, [children, busy, onCancel])
  return <div className="editor-modal-scope" ref={root}>{children}</div>
}
