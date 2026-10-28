import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { Note } from '../api/notes'
import { EditorTabStore, OPEN_TABS_KEY } from './editorTabs'

const note = (id: string, title = id): Note => ({
  id, title, content: `server ${id}`, createdAt: '2026-01-01', updatedAt: '2026-01-02',
})
const stored = () => JSON.parse(localStorage.getItem(OPEN_TABS_KEY) ?? 'null')

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

it('persists only saved ids in order after every tab operation', () => {
  const store = new EditorTabStore()
  const draft = store.create()
  expect(stored()).toEqual([])
  store.setContent(draft, 'private draft')
  expect(stored()).toEqual([])
  const first = store.open(note('a'))
  expect(stored()).toEqual(['a'])
  store.open(note('b'))
  expect(stored()).toEqual(['a', 'b'])
  store.setContent(first, 'unsaved changes')
  expect(stored()).toEqual(['a', 'b'])
  store.setCursor(first, 3, 5)
  expect(stored()).toEqual(['a', 'b'])
  expect(store.getSnapshot().find(tab => tab.key === first)?.cursor).toEqual({ line: 3, column: 5 })
  store.move(first, 2)
  expect(stored()).toEqual(['b', 'a'])
  store.markSaved(draft, note('c'))
  expect(stored()).toEqual(['c', 'b', 'a'])
  expect(store.getSnapshot()[0].dirty).toBe(false)
  store.close(first)
  expect(stored()).toEqual(['c', 'b'])
})

it('restores server content in stored order and silently skips 404 responses', async () => {
  localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(['c', 'deleted', 'a']))
  const fetchMock = vi.fn(async (path: string) => {
    const id = path.split('/').at(-1)!
    // Different completion order must not change tab order.
    if (id === 'c') await Promise.resolve()
    return id === 'deleted' ? new Response(null, { status: 404 })
      : new Response(JSON.stringify(note(id)))
  })
  vi.stubGlobal('fetch', fetchMock)
  const store = new EditorTabStore()
  await expect(store.restore()).resolves.toBeUndefined()
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(store.getSnapshot().map(tab => [tab.noteId, tab.content, tab.dirty]))
    .toEqual([['c', 'server c', false], ['a', 'server a', false]])
  expect(stored()).toEqual(['c', 'a'])
})

it('assigns unique Yeni names across saved and unsaved tabs and marks changed content dirty', () => {
  const store = new EditorTabStore()
  store.open(note('saved', 'Yeni 1'))
  const second = store.create()
  store.create()
  expect(store.getSnapshot().map(tab => tab.title)).toEqual(['Yeni 1', 'Yeni 2', 'Yeni 3'])
  store.setContent(second, '')
  expect(store.getSnapshot()[1].dirty).toBe(false)
  store.setContent(second, 'changed')
  expect(store.getSnapshot()[1].dirty).toBe(true)
  store.close(second)
  store.create()
  expect(store.getSnapshot().at(-1)?.title).toBe('Yeni 2')
})

it('does not hide non-404 failures or replace persisted ids on failure', async () => {
  localStorage.setItem(OPEN_TABS_KEY, '["a"]')
  const error = new ApiError(500, { title: 'Unavailable' })
  const store = new EditorTabStore(localStorage, async () => { throw error })
  await expect(store.restore()).rejects.toBe(error)
  expect(stored()).toEqual(['a'])
})

it('handles malformed storage and duplicate ids', async () => {
  localStorage.setItem(OPEN_TABS_KEY, '{')
  const load = vi.fn(async (id: string) => note(id))
  const store = new EditorTabStore(localStorage, load)
  await store.restore()
  expect(stored()).toEqual([])
  localStorage.setItem(OPEN_TABS_KEY, '["a",null,"a",""]')
  await store.restore()
  expect(load).toHaveBeenCalledTimes(1)
  expect(stored()).toEqual(['a'])
})
