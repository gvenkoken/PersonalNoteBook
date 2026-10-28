import { useEffect, useState } from 'react'
import { notesApi } from '../api/notes'
import type { Note } from '../api/notes'
import type { EditorTab } from '../state/editorTabs'
import { ExportPreviewPanel } from '../features/export-preview/ExportPreviewPanel'
import type { ExportFormat } from '../features/export-preview/ExportPreviewPanel'

export function Preview({ tab, format, onFormatChange, onClose }: {
  tab: EditorTab | undefined; format: ExportFormat
  onFormatChange: (format: ExportFormat) => void; onClose: () => void
}) {
  const [saved, setSaved] = useState<Note | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let current = true
    setSaved(null); setError(false)
    if (tab?.noteId) void notesApi.get(tab.noteId).then(note => {
      if (current) setSaved(note)
    }).catch(() => { if (current) setError(true) })
    return () => { current = false }
  }, [tab?.noteId, tab?.dirty])
  const note = tab ? tab.noteId === null
    ? { id: '', title: tab.title, content: tab.content, createdAt: '', updatedAt: '' }
    : saved?.id === tab.noteId ? { ...saved, title: tab.title, content: tab.content } : null
    : null
  if (error || (tab?.noteId && !note)) return <aside className="export-preview-panel">
    <p role={error ? 'alert' : 'status'}>{error ? 'Not bilgileri yüklenemedi. Önizlemeyi kapatıp yeniden deneyin.' : 'Not bilgileri yükleniyor…'}</p>
    <button onClick={onClose}>Önizlemeyi kapat</button>
  </aside>
  return <ExportPreviewPanel note={note} format={format} onFormatChange={onFormatChange} onClose={onClose} />
}
