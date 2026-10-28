import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EditorTabStore } from '../../state/editorTabs'
import { SaveEditor } from './SaveEditor'

const note = { id: '1', title: 'Not', content: 'ilk', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function setup(saved = true) {
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  const key = saved ? store.open(note) : store.create()
  store.setContent(key, 'değişiklik')
  render(<SaveEditor store={store} />)
  return store
}

it('prevents browser Ctrl+S and PUTs a saved note; the button also saves', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ...note, content: 'değişiklik' })))
  vi.stubGlobal('fetch', fetch)
  const store = setup()
  const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true, bubbles: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  await waitFor(() => expect(store.getSnapshot()[0].dirty).toBe(false))
  expect(fetch).toHaveBeenCalledWith('/api/notes/1', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ title: 'Not', content: 'değişiklik' }),
  }))
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
})

it('keeps the entered name and dialog on server 409', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method
    ? new Response('{}', { status: 409 }) : new Response('[]')))
  setup(false)
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  expect((screen.getByLabelText('Not adı') as HTMLInputElement).value).toBe('Yeni 1')
  fireEvent.change(screen.getByLabelText('Not adı'), { target: { value: 'Aynı ad' } })
  fireEvent.submit(screen.getByLabelText('Not adı').closest('form')!)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('zaten var'))
  expect((screen.getByLabelText('Not adı') as HTMLInputElement).value).toBe('Aynı ad')
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it('preserves content and dirty marker on 500 and explains retry in the status bar', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
  const store = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  await screen.findByText(/Kaydet ile yeniden deneyin/)
  expect((screen.getByLabelText('Not içeriği') as HTMLTextAreaElement).value).toBe('değişiklik')
  expect(screen.getByLabelText('Kaydedilmemiş değişiklikler').textContent).toContain('*')
  expect(store.getSnapshot()[0].dirty).toBe(true)
})

it('checks listed names before writing and allows cancel without saving', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify([note])))
  vi.stubGlobal('fetch', fetch)
  setup(false)
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
  fireEvent.change(screen.getByLabelText('Not adı'), { target: { value: 'Not' } })
  fireEvent.submit(screen.getByLabelText('Not adı').closest('form')!)
  await screen.findByRole('alert')
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('creates on first save and uses the same naming dialog from tab and menu', async () => {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => new Response(
    JSON.stringify(init?.method ? { ...note, title: 'Yeni 1', content: 'değişiklik' } : [])))
  vi.stubGlobal('fetch', fetch)
  const store = setup(false)
  fireEvent.doubleClick(screen.getByRole('tab'))
  fireEvent.submit(screen.getByLabelText('Not adı').closest('form')!)
  await waitFor(() => expect(store.getSnapshot()[0].dirty).toBe(false))
  expect(fetch).toHaveBeenCalledWith('/api/notes/', expect.objectContaining({ method: 'POST' }))
  fireEvent.click(screen.getByRole('button', { name: 'Adını değiştir' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
})
