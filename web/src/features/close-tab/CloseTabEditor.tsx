import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { notesApi } from '../../api/notes'
import type { Note } from '../../api/notes'
import { Editor } from '../../editor/Editor'
import type { EditorTab, EditorTabStore } from '../../state/editorTabs'

type SaveNote = (tab: EditorTab) => Promise<Note>
const saveNote: SaveNote = tab => {
  const request = { title: tab.title, content: tab.content }
  return tab.noteId === null ? notesApi.create(request) : notesApi.update(tab.noteId, request)
}

/** Scoped integration surface; mount once beside the editor sharing this store. */
export function CloseTabControls({ store, save = saveNote }: {
  store: EditorTabStore; save?: SaveNote
}) {
  const tabs = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [closingKey, setClosingKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const id = useId()
  const closing = tabs.find(tab => tab.key === closingKey)

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!store.getSnapshot().some(tab => tab.dirty)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [store])

  function requestClose(tab: EditorTab) {
    if (pending.current || closing) return
    setError('')
    if (tab.dirty) setClosingKey(tab.key)
    else store.close(tab.key)
  }

  async function saveAndClose() {
    if (!closing || pending.current) return
    const snapshot = closing
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const note = await save(snapshot)
      const current = store.getSnapshot().find(tab => tab.key === snapshot.key)
      if (!current) { setClosingKey(null); return }
      store.markSaved(snapshot.key, note)
      if (current.content !== snapshot.content || current.title !== snapshot.title) {
        store.setContent(snapshot.key, current.content)
        setError('Kayıt sırasında not değişti. Son değişiklikleri kaydetmek için tekrar deneyin.')
        return
      }
      store.close(snapshot.key)
      setClosingKey(null)
    } catch {
      setError('Not kaydedilemedi. Sekmeniz ve içeriğiniz korunuyor. Yeniden deneyin.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <>
    <div role="group" aria-label="Sekmeleri kapat">
      {tabs.map(tab => <button key={tab.key} disabled={busy || Boolean(closing)}
        onClick={() => requestClose(tab)} aria-label={`${tab.title} sekmesini kapat`}>{tab.title} ×</button>)}
    </div>
    {closing && <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`} aria-busy={busy}
      onKeyDown={event => {
        if (event.key === 'Escape' && !pending.current) setClosingKey(null)
      }}>
      <h2 id={`${id}-title`}>{closing.title} kapatılsın mı?</h2>
      <p id={`${id}-description`}>Bu notta kaydedilmemiş değişiklikler var. Kaydetme seçilirse değişiklikler kaybolacak.</p>
      <button disabled={busy} onClick={() => { void saveAndClose() }}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
      <button disabled={busy} onClick={() => { store.close(closing.key); setClosingKey(null); setError('') }}>Kaydetme</button>
      <button autoFocus disabled={busy} onClick={() => { setClosingKey(null); setError('') }}>Vazgeç</button>
    </div>}
    <div role="status" aria-label="Kapanış durumu">{busy ? 'Kaydediliyor…' : error}</div>
  </>
}

export function CloseTabEditor({ store }: { store: EditorTabStore }) {
  return <><Editor store={store} /><CloseTabControls store={store} /></>
}
