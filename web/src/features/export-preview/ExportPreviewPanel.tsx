import { useId } from 'react'
import { exportFileName, toNoteHtml, toNoteJson } from '../../conversion'
import type { Note } from '../../conversion'
import './export-preview.css'

export type ExportFormat = 'json' | 'html'

export function ExportPreviewPanel({ note, format, onFormatChange, onClose }: {
  note: Note | null
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  onClose: () => void
}) {
  const id = useId()
  const output = note ? (format === 'json' ? toNoteJson(note) : toNoteHtml(note)) : ''
  const filename = note ? exportFileName(note.title, format) : ''
  function download() {
    if (!note) return
    const url = URL.createObjectURL(new Blob([output], {
      type: format === 'json' ? 'application/json;charset=utf-8' : 'text/html;charset=utf-8',
    }))
    const anchor = document.createElement('a')
    try {
      anchor.href = url
      anchor.download = filename
      document.body.append(anchor)
      anchor.click()
    } finally {
      anchor.remove()
      URL.revokeObjectURL(url)
    }
  }
  return <aside className="export-preview-panel" aria-labelledby={`${id}-title`}>
    <header><h2 id={`${id}-title`}>Dışa aktarma önizlemesi</h2>
      <button onClick={onClose} aria-label="Önizlemeyi kapat">×</button></header>
    <label htmlFor={`${id}-format`}>Biçim</label>
    <select id={`${id}-format`} value={format} onChange={event => onFormatChange(event.target.value as ExportFormat)}>
      <option value="json">JSON</option><option value="html">HTML</option>
    </select>
    {note ? <><h3>{note.title}</h3>
      <pre className="export-preview-source" aria-label={`${format.toUpperCase()} kaynağı`}>{output}</pre>
      <button onClick={download}>{format.toUpperCase()} indir — {filename}</button>
    </> : <p role="status">Önizlemek için bir not seçin.</p>}
  </aside>
}
