import { useEffect, useState } from 'react'
import { Editor } from './editor/Editor'
import { EditorTabStore } from './state/editorTabs'
import { notesApi } from './api/notes'

type Status = 'checking' | 'ready' | 'unavailable'

export function App() {
  const [status, setStatus] = useState<Status>('checking')
  const [updatedAt, setUpdatedAt] = useState<Record<string, string>>({})
  const [store] = useState(() => new EditorTabStore(localStorage, async id => {
    const note = await notesApi.get(id)
    setUpdatedAt(previous => ({ ...previous, [id]: note.updatedAt }))
    return note
  }))
  const [loading, setLoading] = useState(true)
  const [restoreError, setRestoreError] = useState(false)
  useEffect(() => {
    let active = true
    store.restore().catch(() => { if (active) setRestoreError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [store])
  useEffect(() => {
    let active = true
    fetch('/health/ready')
      .then((r) => active && setStatus(r.ok ? 'ready' : 'unavailable'))
      .catch(() => active && setStatus('unavailable'))
    return () => {
      active = false
    }
  }, [])
  return (
    <>
      <Editor store={store} loading={loading} updatedAt={updatedAt} />
      {restoreError && <p role="alert">Önceki notlar yüklenemedi. Sayfayı yenileyerek tekrar deneyin.</p>}
      <p className="api-status" role="status">API: {status}</p>
    </>
  )
}
