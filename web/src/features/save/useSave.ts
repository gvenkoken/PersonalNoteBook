import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { notesApi } from '../../api/notes'
import type { EditorTabStore } from '../../state/editorTabs'

const conflict = 'Bu adla bir not zaten var. Başka bir ad girin.'

/** Manual saving only; the caller supplies the currently selected tab. */
export function useSave(store: EditorTabStore, activeKey: string | undefined) {
  const [namingKey, setNamingKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState('')
  const [status, setStatus] = useState('')
  const pending = useRef(false)
  const tab = (key: string) => store.getSnapshot().find(item => item.key === key)

  function rename(key = activeKey) {
    if (!key || !tab(key) || pending.current) return
    setNameError('')
    setNamingKey(key)
  }

  async function write(key: string, title: string, naming: boolean) {
    const snapshot = tab(key)
    if (!snapshot || pending.current) return
    pending.current = true
    setBusy(true)
    setNameError('')
    setStatus('')
    try {
      if (!title.trim()) { setNameError('Not adı gereklidir.'); return }
      if (naming) {
        const listed = await notesApi.list()
        if (store.getSnapshot().some(item => item.key !== key && item.title === title) ||
          listed.some(item => item.id !== snapshot.noteId && item.title === title)) {
          setNameError(conflict)
          return
        }
      }
      const request = { title, content: snapshot.content }
      const note = snapshot.noteId
        ? await notesApi.update(snapshot.noteId, request)
        : await notesApi.create(request)
      const current = tab(key)
      if (current) {
        // Preserve edits made while the request was in flight.
        store.markSaved(key, note)
        if (current.content !== snapshot.content) store.setContent(key, current.content)
      }
      setNamingKey(null)
      setStatus('Not kaydedildi.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNamingKey(key)
        setNameError(conflict)
      } else {
        setStatus('Not kaydedilemedi. İçeriğiniz korunuyor; Kaydet ile yeniden deneyin.')
      }
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  function save() {
    if (!activeKey || pending.current || namingKey) return
    const current = tab(activeKey)
    if (!current) return
    if (current.noteId === null) rename(activeKey)
    else void write(activeKey, current.title, false)
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  return {
    save, rename, busy, status, nameError,
    namingTab: namingKey ? tab(namingKey) : undefined,
    submitName: (title: string) => { if (namingKey) void write(namingKey, title, true) },
    cancelNaming: () => { if (!pending.current) setNamingKey(null) },
  }
}
