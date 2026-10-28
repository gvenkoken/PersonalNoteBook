import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EditorTabStore, OPEN_TABS_KEY } from '../../state/editorTabs'
import { DeleteNoteEditor } from './DeleteNoteEditor'

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

function setup() {
  const store = new EditorTabStore()
  const key = store.open({ id: 'note-1', title: 'Alışveriş', content: 'Ekmek', createdAt: '', updatedAt: '' })
  render(<DeleteNoteEditor store={store} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0])
  return { store, key }
}

it('cancels without a request or changing the note, tab or persisted ids', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const { store } = setup()
  const before = store.getSnapshot()
  expect(within(screen.getByRole('dialog')).getByText('Alışveriş')).toBeTruthy()
  expect(screen.getByText('Bu not kalıcı olarak silinecek')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(fetch).not.toHaveBeenCalled()
  expect(store.getSnapshot()).toBe(before)
  expect(localStorage.getItem(OPEN_TABS_KEY)).toBe('["note-1"]')
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('deletes only the selected note and removes its tab and persisted id', async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  const store = new EditorTabStore()
  store.open({ id: 'other', title: 'Diğer', content: '', createdAt: '', updatedAt: '' })
  const key = store.open({ id: 'selected', title: 'Seçili', content: '', createdAt: '', updatedAt: '' })
  render(<DeleteNoteEditor store={store} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Seçili' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[1])
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/notes/selected', expect.objectContaining({ method: 'DELETE' }))
  expect(store.getSnapshot().some(tab => tab.key === key)).toBe(false)
  expect(screen.getAllByRole('tab')).toHaveLength(1)
  expect(localStorage.getItem(OPEN_TABS_KEY)).toBe('["other"]')
})

it('shows a 500 error inside the dialog and preserves the tab for retry', async () => {
  const fetch = vi.fn(async () => new Response('{}', { status: 500 }))
  vi.stubGlobal('fetch', fetch)
  const { store } = setup()
  const before = store.getSnapshot()
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeTruthy()
  expect(store.getSnapshot()).toBe(before)
  expect(screen.getAllByRole('tab')).toHaveLength(1)
  expect(localStorage.getItem(OPEN_TABS_KEY)).toBe('["note-1"]')
  fetch.mockImplementation(async () => new Response(null, { status: 204 }))
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
  await waitFor(() => expect(store.getSnapshot()).toHaveLength(0))
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('shows progress and prevents duplicate requests and cancellation while deleting', async () => {
  let finish!: (response: Response) => void
  const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  const { store } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
  expect(screen.getByText('Siliniyor…')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(store.getSnapshot()).toHaveLength(1)
  finish(new Response(null, { status: 204 }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('closes an unsaved new note without calling the server', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const store = new EditorTabStore()
  store.create()
  render(<DeleteNoteEditor store={store} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[1])
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(fetch).not.toHaveBeenCalled()
  expect(store.getSnapshot()).toHaveLength(0)
  expect(localStorage.getItem(OPEN_TABS_KEY)).toBe('[]')
})
