import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EditorTabStore, OPEN_TABS_KEY } from '../../state/editorTabs'
import type { Note } from '../../api/notes'
import { CloseTabControls } from './CloseTabEditor'

afterEach(cleanup)
const note: Note = { id: 'one', title: 'Not', content: 'eski', createdAt: '', updatedAt: '' }
function setup(save = vi.fn(async () => ({ ...note, content: 'yeni' }))) {
  const storage = { getItem: () => null, setItem: vi.fn() }
  const store = new EditorTabStore(storage)
  const key = store.open(note)
  store.setContent(key, 'yeni')
  const view = render(<CloseTabControls store={store} save={save} />)
  fireEvent.click(screen.getByRole('button', { name: 'Not sekmesini kapat' }))
  return { store, key, storage, save, ...view }
}

it('Kaydet saves the dirty content and removes the tab from storage', async () => {
  const { store, storage, save } = setup()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Kaydet' })) })
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ content: 'yeni', noteId: 'one' }))
  expect(store.getSnapshot()).toEqual([])
  expect(storage.setItem).toHaveBeenLastCalledWith(OPEN_TABS_KEY, '[]')
})

it('Kaydetme warns about loss and closes without saving', () => {
  const { store, save, storage } = setup()
  expect(screen.getByText(/değişiklikler kaybolacak/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Kaydetme' }))
  expect(store.getSnapshot()).toEqual([])
  expect(save).not.toHaveBeenCalled()
  expect(storage.setItem).toHaveBeenLastCalledWith(OPEN_TABS_KEY, '[]')
})

it('Vazgeç leaves the tab and all its state intact', () => {
  const { store, save } = setup()
  const before = store.getSnapshot()
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(store.getSnapshot()).toBe(before)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(save).not.toHaveBeenCalled()
})

it('keeps the dirty content and displays a save failure', async () => {
  const { store } = setup(vi.fn(async () => { throw new Error('offline') }))
  const before = store.getSnapshot()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Kaydet' })) })
  expect(store.getSnapshot()).toBe(before)
  expect(screen.getByRole('status').textContent).toContain('Not kaydedilemedi')
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it('shows progress and prevents duplicate requests while saving', async () => {
  let resolve!: (value: Note) => void
  const save = vi.fn(() => new Promise<Note>(done => { resolve = done }))
  const { store } = setup(save)
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  expect(screen.getByRole('dialog').getAttribute('aria-busy')).toBe('true')
  expect((screen.getByRole('button', { name: 'Kaydetme' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Kaydediliyor…' }))
  expect(save).toHaveBeenCalledTimes(1)
  await act(async () => { resolve({ ...note, content: 'yeni' }) })
  expect(store.getSnapshot()).toEqual([])
})

it('cancels beforeunload only with dirty tabs and removes its listener on unmount', () => {
  const { store, key, unmount } = setup()
  const dirty = new Event('beforeunload', { cancelable: true })
  expect(window.dispatchEvent(dirty)).toBe(false)
  expect(dirty.defaultPrevented).toBe(true)
  expect(dirty.returnValue).toBe(false)
  act(() => { store.markSaved(key, { ...note, content: 'yeni' }) })
  const clean = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(clean)
  expect(clean.defaultPrevented).toBe(false)
  act(() => { store.setContent(key, 'başka') })
  unmount()
  const removed = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(removed)
  expect(removed.defaultPrevented).toBe(false)
})

it('closes clean tabs immediately', () => {
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  store.open(note)
  render(<CloseTabControls store={store} />)
  fireEvent.click(screen.getByRole('button', { name: 'Not sekmesini kapat' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(store.getSnapshot()).toEqual([])
})
