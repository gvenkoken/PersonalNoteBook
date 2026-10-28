import { useEffect, useId, useRef, useState } from 'react'
import { notesApi } from '../../api/notes'
import type { Note, NoteSummary } from '../../api/notes'
import type { EditorTabStore } from '../../state/editorTabs'
import './open-note.css'

export function OpenNoteDialog({ store, onOpened, onCancel }: {
  store: EditorTabStore
  onOpened: (key: string) => void
  onCancel: () => void
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  const pending = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    alive.current = true
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    root.current?.focus()
    return () => { alive.current = false; previous?.focus({ preventScroll: true }) }
  }, [])

  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    notesApi.list().then(items => {
      if (current) { setNotes(items); setSelected('') }
    }).catch(() => {
      if (current) setError('Not listesi yüklenemedi.')
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [attempt])

  async function open() {
    if (!selected || pending.current) return
    const existing = store.getSnapshot().find(tab => tab.noteId === selected)
    if (existing) { onOpened(existing.key); return }
    pending.current = true
    setOpening(true)
    setError('')
    try {
      const note: Note = await notesApi.get(selected)
      if (alive.current) onOpened(store.open(note))
    } catch {
      if (alive.current) setError('Not açılamadı. Yeniden deneyin.')
    } finally {
      pending.current = false
      if (alive.current) setOpening(false)
    }
  }

  return <div className="open-note-backdrop">
    <div className="open-note-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      ref={root} tabIndex={-1} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onCancel() }
        if (event.key !== 'Tab') return
        const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) {
          event.preventDefault(); first?.focus()
        }
      }}>
      <h2 id={`${id}-title`}>Kayıtlı notu aç</h2>
      {loading ? <p role="status">Notlar yükleniyor…</p> : <>
        {!error && notes.length === 0 && <p role="status">Henüz kayıtlı not yok.</p>}
        {notes.length > 0 && <fieldset disabled={opening}>
          <legend>Kayıtlı notlar</legend>
          {notes.map(note => <label key={note.id} className={`open-note-row${selected === note.id ? ' selected' : ''}`}>
            <input type="radio" name={`${id}-note`} value={note.id} checked={selected === note.id}
              onChange={() => { setSelected(note.id); setError('') }} />
            <span>{note.title}</span>
            <time dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleString('tr-TR')}</time>
          </label>)}
        </fieldset>}
      </>}
      {error && <p role="alert">{error}</p>}
      {error && <button disabled={opening} onClick={() => {
        if (notes.length) void open()
        else setAttempt(value => value + 1)
      }}>Yeniden dene</button>}
      <div className="open-note-actions">
        <button disabled={loading || opening || !selected} onClick={() => { void open() }}>{opening ? 'Açılıyor…' : 'Aç'}</button>
        <button onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  </div>
}
