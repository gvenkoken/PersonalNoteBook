import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EditorTabStore } from '../../state/editorTabs'
import { OpenNoteEditor } from './OpenNoteEditor'

const summary = { id: 'saved', title: 'Alışveriş', updatedAt: '2026-10-28T10:00:00Z' }
const note = { ...summary, content: 'Sunucudan gelen içerik', createdAt: summary.updatedAt }
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 })
function setup() {
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  const key = store.create()
  store.setContent(key, 'Taslak')
  render(<OpenNoteEditor store={store} />)
  return { store, key }
}
function show() {
  fireEvent.click(screen.getByText('Dosya'))
  fireEvent.click(screen.getByRole('button', { name: 'Aç' }))
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('lists names and dates, then opens the server content in a new active tab', async () => {
  const fetch = vi.fn(async (path: string | URL | Request) =>
    response(String(path) === '/api/notes/' ? [summary] : note))
  vi.stubGlobal('fetch', fetch)
  const { store } = setup()
  show()
  const option = await screen.findByRole('radio')
  expect(screen.getByText(new Date(summary.updatedAt).toLocaleString('tr-TR'))).toBeTruthy()
  fireEvent.click(option)
  expect((option as HTMLInputElement).checked).toBe(true)
  expect(option.closest('label')?.classList.contains('selected')).toBe(true)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aç' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(note.content)
  expect(store.getSnapshot()).toHaveLength(2)
  expect(store.getSnapshot()[0].content).toBe('Taslak')
  expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/notes/', '/api/notes/saved'])
})

it('activates an already open note without replacing its unsaved work or cursor', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response([summary])))
  const { store } = setup()
  const savedKey = store.open(note)
  store.setContent(savedKey, 'Yerel değişiklik')
  store.setCursor(savedKey, 2, 3)
  const before = store.getSnapshot()
  show()
  fireEvent.click(await screen.findByRole('radio'))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aç' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(store.getSnapshot()).toBe(before)
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Yerel değişiklik')
  expect(screen.getByRole('tab', { name: /Alışveriş/ }).getAttribute('aria-selected')).toBe('true')
})

it('shows loading, a list failure, retry, and the empty state', async () => {
  let finish!: (value: Response) => void
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockResolvedValueOnce(response([]))
  vi.stubGlobal('fetch', fetch)
  setup()
  show()
  expect(screen.getByText('Notlar yükleniyor…')).toBeTruthy()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await act(async () => { finish(new Response(null, { status: 500 })) })
  expect(await screen.findByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))
  expect(await screen.findByText('Henüz kayıtlı not yok.')).toBeTruthy()
  expect((within(screen.getByRole('dialog')).getByRole('button', { name: 'Aç' }) as HTMLButtonElement).disabled).toBe(true)
})

it('retries a failed note fetch without changing tabs', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response([summary]))
    .mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(response(note))
  vi.stubGlobal('fetch', fetch)
  const { store } = setup()
  const before = store.getSnapshot()
  show()
  fireEvent.click(await screen.findByRole('radio'))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aç' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(store.getSnapshot()).toBe(before)
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(store.getSnapshot()).toHaveLength(2)
})

it('cancels a pending open, restores focus, and ignores its late response', async () => {
  let finish!: (value: Response) => void
  const fetch = vi.fn().mockResolvedValueOnce(response([summary]))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetch)
  const { store } = setup()
  const before = store.getSnapshot()
  fireEvent.click(screen.getByText('Dosya'))
  const opener = screen.getByRole('button', { name: 'Aç' })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.click(await screen.findByRole('radio'))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aç' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
  await act(async () => { finish(response(note)) })
  expect(store.getSnapshot()).toBe(before)
})
