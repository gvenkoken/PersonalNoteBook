import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { notesApi } from '../../api/notes'
import type { Note } from '../../conversion'
import { Editor } from '../../editor/Editor'
import type { EditorTabStore } from '../../state/editorTabs'
import { ExportPreviewPanel } from './ExportPreviewPanel'
import type { ExportFormat } from './ExportPreviewPanel'

/** Integrates the existing menu without changing the shared editor. */
export function ExportPreviewEditor({ store, loading = false, updatedAt = {} }: {
  store: EditorTabStore; loading?: boolean; updatedAt?: Readonly<Record<string, string>>
}) {
  const host = useRef<HTMLDivElement>(null)
  const tabs = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [format, setFormat] = useState<ExportFormat>('json')
  const [visible, setVisible] = useState(false)
  const [saved, setSaved] = useState<Note | null>(null)
  const [error, setError] = useState('')
  const trigger = useRef<HTMLButtonElement | null>(null)
  const active = tabs.find(tab => tab.key === selectedKey) ?? tabs[0]
  const noteId = active?.noteId
  const timestamp = updatedAt[noteId ?? '']

  useLayoutEffect(() => {
    const root = host.current
    if (!root) return
    const syncSelection = () => {
      const selected = root.querySelector('[role="tab"][aria-selected="true"]')
      setSelectedKey(store.getSnapshot().find(tab => `tab-${tab.key}` === selected?.id)?.key ?? null)
    }
    syncSelection()
    const observer = new MutationObserver(syncSelection)
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['aria-selected'], childList: true })
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.menus button'))
      .filter(button => button.textContent === 'JSON' || button.textContent === 'HTML')
    const open = (event: MouseEvent) => {
      trigger.current = event.currentTarget as HTMLButtonElement
      setFormat(trigger.current.textContent === 'HTML' ? 'html' : 'json')
      setVisible(true)
    }
    buttons.forEach(button => { button.disabled = loading; button.addEventListener('click', open) })
    return () => {
      observer.disconnect()
      buttons.forEach(button => button.removeEventListener('click', open))
    }
  }, [store, loading])

  useEffect(() => {
    let cancelled = false
    setSaved(null)
    setError('')
    if (visible && noteId) {
      void notesApi.get(noteId).then(note => {
        if (!cancelled) setSaved(note)
      }).catch(() => {
        if (!cancelled) setError('Not bilgileri yüklenemedi. Önizlemeyi kapatıp yeniden deneyin.')
      })
    }
    return () => { cancelled = true }
  }, [visible, noteId, timestamp, active?.dirty])

  // Unsaved tabs have no persistent id or server timestamps yet.
  const note: Note | null = active && !loading
    ? active.noteId === null
      ? { id: '', title: active.title, content: active.content, createdAt: '', updatedAt: '' }
      : saved?.id === active.noteId ? { ...saved, title: active.title, content: active.content } : null
    : null
  function close() {
    setVisible(false)
    trigger.current?.focus()
  }
  return <div className={`export-preview-layout${visible ? ' export-preview-open' : ''}`}>
    <div ref={host} className="export-preview-editor"><Editor store={store} loading={loading} updatedAt={updatedAt} /></div>
    {visible && (error ? <aside className="export-preview-panel"><p role="alert">{error}</p>
      <button onClick={close}>Önizlemeyi kapat</button></aside>
      : (loading || (active?.noteId && !note)) ? <aside className="export-preview-panel"><p role="status">Not bilgileri yükleniyor…</p>
        <button onClick={close}>Önizlemeyi kapat</button></aside>
      : <ExportPreviewPanel note={note} format={format} onFormatChange={setFormat} onClose={close} />)}
  </div>
}
