import { useId, useState } from 'react'

export function NamingDialog({ initialTitle, busy, error, onSave, onCancel }: {
  initialTitle: string
  busy: boolean
  error: string
  onSave: (title: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const id = useId()
  return <div role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>Notu adlandır</h2>
    <form aria-busy={busy} onSubmit={event => { event.preventDefault(); if (!busy) onSave(title) }}>
      <label htmlFor={id}>Not adı</label>
      <input id={id} autoFocus value={title} disabled={busy}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => setTitle(event.target.value)} />
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
      <button type="submit" disabled={busy || !title.trim()}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
      <button type="button" disabled={busy} onClick={onCancel}>Vazgeç</button>
    </form>
  </div>
}
