import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { notesApi } from '../../api/notes'
import { Editor } from '../../editor/Editor'
import type { EditorTab, EditorTabStore } from '../../state/editorTabs'
import './delete-note.css'

export function DeleteNoteDialog({ store, tab, onClose }: {
  store: EditorTabStore; tab: EditorTab; onClose: () => void
}) {
  const id = useId()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      if (tab.noteId !== null) await notesApi.delete(tab.noteId)
      store.close(tab.key)
      onClose()
    } catch {
      setError('Not silinemedi. Yeniden deneyin veya vazgeçin.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <div className="delete-note-backdrop">
    <div className="delete-note-dialog" role="dialog" aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-warning`} aria-busy={busy}
      onKeyDown={event => {
        if (event.key === 'Escape' && !pending.current) onClose()
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
          const next = event.shiftKey ? buttons[buttons.length - 1] : buttons[0]
          const boundary = event.shiftKey ? buttons[0] : buttons[buttons.length - 1]
          if (document.activeElement === boundary) { event.preventDefault(); next?.focus() }
        }
      }}>
      <h2 id={`${id}-title`}>{tab.title}</h2>
      <p id={`${id}-warning`}>Bu not kalıcı olarak silinecek</p>
      {busy && <p role="status">Siliniyor…</p>}
      {error && <p role="alert">{error}</p>}
      <button className="delete-note-confirm" disabled={busy} onClick={() => { void confirm() }}>Kalıcı sil</button>
      <button autoFocus disabled={busy} onClick={onClose}>Vazgeç</button>
    </div>
  </div>
}

/** Scope-local integration with the editor's existing menu and toolbar commands. */
export function DeleteNoteEditor({ store, loading = false, updatedAt = {} }: {
  store: EditorTabStore; loading?: boolean; updatedAt?: Readonly<Record<string, string>>
}) {
  const host = useRef<HTMLDivElement>(null)
  const tabs = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [target, setTarget] = useState<EditorTab | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    const buttons = Array.from(host.current?.querySelectorAll<HTMLButtonElement>('.menus button, .toolbar button') ?? [])
      .filter(button => button.textContent?.trim().replace(/^×\s*/, '') === 'Sil')
    const request = (event: MouseEvent) => {
      const selected = host.current?.querySelector('[role="tab"][aria-selected="true"]')
      const tab = store.getSnapshot().find(item => `tab-${item.key}` === selected?.id)
      if (tab) { trigger.current = event.currentTarget as HTMLButtonElement; setTarget(tab) }
    }
    buttons.forEach(button => {
      button.disabled = loading || tabs.length === 0 || target !== null
      button.addEventListener('click', request)
    })
    return () => { buttons.forEach(button => button.removeEventListener('click', request)) }
  }, [store, tabs, loading, target])

  return <div ref={host}>
    <Editor store={store} loading={loading} updatedAt={updatedAt} />
    {target && <DeleteNoteDialog store={store} tab={target} onClose={() => {
      setTarget(null)
      requestAnimationFrame(() => { trigger.current?.focus() })
    }} />}
  </div>
}
