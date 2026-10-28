import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '../../editor/Editor'
import type { EditorTabStore } from '../../state/editorTabs'
import { OpenNoteDialog } from './OpenNoteDialog'

/** Scope-local integration with the existing editor's File menu and tabs. */
export function OpenNoteEditor({ store, loading = false, updatedAt = {} }: {
  store: EditorTabStore; loading?: boolean; updatedAt?: Readonly<Record<string, string>>
}) {
  const host = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<Element | null>(null)
  const [visible, setVisible] = useState(false)
  const [opened, setOpened] = useState<string | null>(null)
  useLayoutEffect(() => {
    setMenu(host.current?.querySelector('.menus details .menu-items') ?? null)
  }, [])
  useLayoutEffect(() => {
    if (!opened || visible) return
    const tab = Array.from(host.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
      .find(element => element.id === `tab-${opened}`)
    tab?.click()
    host.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true })
    setOpened(null)
  }, [opened, visible])
  return <div ref={host}>
    <Editor store={store} loading={loading} updatedAt={updatedAt} />
    {menu && createPortal(<button disabled={loading} onClick={() => setVisible(true)}>Aç</button>, menu)}
    {visible && <OpenNoteDialog store={store} onCancel={() => setVisible(false)}
      onOpened={key => { setOpened(key); setVisible(false) }} />}
  </div>
}
