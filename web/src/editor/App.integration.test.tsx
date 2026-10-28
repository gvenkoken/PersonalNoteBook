import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { notesApi } from '../api/notes'
import { ApiError } from '../api/client'
import { OPEN_TABS_KEY } from '../state/editorTabs'

const note = { id: 'one', title: 'Kayıtlı', content: 'Sunucu', createdAt: '2026-01-01', updatedAt: '2026-01-02' }
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
  vi.spyOn(notesApi, 'list').mockResolvedValue([note])
  vi.spyOn(notesApi, 'get').mockResolvedValue(note)
  vi.spyOn(notesApi, 'create').mockImplementation(async request => ({ ...note, ...request }))
  vi.spyOn(notesApi, 'update').mockImplementation(async (id, request) => ({ ...note, id, ...request }))
  vi.spyOn(notesApi, 'delete').mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function setup(ids: string[] = []) {
  localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(ids))
  render(<App />)
  await waitFor(() => expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('false'))
  fireEvent.click(screen.getByText('Dosya'))
}
function menu(name: string) { return within(screen.getByRole('navigation')).getByRole('button', { name }) }
function tool(name: string) { return within(screen.getByRole('toolbar')).getByRole('button', { name }) }
async function escapeTo(trigger: HTMLElement) {
  const dialog = screen.getByRole('dialog')
  expect(dialog.contains(document.activeElement)).toBe(true)
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
}

it.each(['menu', 'toolbar'])('connects %s new, save and delete commands with focus restoration', async source => {
  await setup()
  const command = source === 'menu' ? menu : tool
  fireEvent.click(command('Yeni'))
  fireEvent.change(screen.getByLabelText('Not içeriği'), { target: { value: 'Taslak' } })
  const save = command('Kaydet')
  save.focus(); fireEvent.click(save)
  expect(screen.getByRole('dialog').textContent).toContain('Notu adlandır')
  const name = screen.getByLabelText('Not adı')
  const cancel = screen.getByRole('button', { name: 'Vazgeç' })
  cancel.focus()
  fireEvent.keyDown(cancel, { key: 'Tab' })
  expect(document.activeElement).toBe(name)
  fireEvent.keyDown(name, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(cancel)
  await escapeTo(save)
  const remove = command('Sil')
  remove.focus(); fireEvent.click(remove)
  expect(screen.getByRole('dialog').textContent).toContain('Bu not kalıcı olarak silinecek')
  await escapeTo(remove)
  expect(notesApi.create).not.toHaveBeenCalled()
  expect(notesApi.delete).not.toHaveBeenCalled()
})

it('connects rename, double click, Ctrl+S, and saves through the naming workflow', async () => {
  await setup()
  fireEvent.click(tool('Yeni'))
  const rename = menu('Ad Değiştir')
  rename.focus(); fireEvent.click(rename)
  await escapeTo(rename)
  const tab = screen.getByRole('tab')
  tab.focus(); fireEvent.doubleClick(tab)
  await escapeTo(tab)
  const input = screen.getByLabelText('Not içeriği')
  fireEvent.change(input, { target: { value: 'Yeni içerik' } })
  input.focus(); fireEvent.keyDown(input, { key: 's', ctrlKey: true })
  fireEvent.change(screen.getByLabelText('Not adı'), { target: { value: 'Başlık' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Kaydet' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(notesApi.create).toHaveBeenCalledWith({ title: 'Başlık', content: 'Yeni içerik' })
  expect(screen.getByRole('tab').textContent).toBe('Başlık')
  expect(localStorage.getItem(OPEN_TABS_KEY)).toBe('["one"]')
  await waitFor(() => expect(document.activeElement).toBe(input))
})

it('opens an existing note and restores focus on cancellation', async () => {
  await setup()
  const open = menu('Aç')
  open.focus(); fireEvent.click(open)
  await screen.findByRole('radio')
  await escapeTo(open)
  fireEvent.click(open)
  fireEvent.click(await screen.findByRole('radio'))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aç' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((screen.getByLabelText('Not içeriği') as HTMLTextAreaElement).value).toBe(note.content)
})

it('restores saved ids in order, skipping missing notes, and connects both preview formats', async () => {
  vi.mocked(notesApi.get).mockImplementation(async id => {
    if (id === 'missing') throw new ApiError(404, {})
    return { ...note, id, title: id }
  })
  await setup(['two', 'missing', 'one'])
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['two', 'one'])
  expect(localStorage.getItem(OPEN_TABS_KEY)).toBe('["two","one"]')
  fireEvent.click(screen.getByText('Dönüştür'))
  for (const format of ['JSON', 'HTML']) {
    const trigger = menu(format)
    trigger.focus(); fireEvent.click(trigger)
    expect(await screen.findByLabelText(`${format} kaynağı`)).toBeTruthy()
    expect(screen.getAllByRole('complementary')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Önizlemeyi kapat' }))
    expect(document.activeElement).toBe(trigger)
  }
})

it('confirms dirty closure with cancel, discard, or save and warns before unloading', async () => {
  await setup()
  fireEvent.click(tool('Yeni'))
  fireEvent.change(screen.getByLabelText('Not içeriği'), { target: { value: 'Taslak' } })
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  const close = screen.getByRole('button', { name: 'Yeni 1 sekmesini kapat' })
  close.focus(); fireEvent.click(close)
  await escapeTo(close)
  fireEvent.click(close)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Kaydet' }))
  expect(screen.getByLabelText('Not adı')).toBeTruthy()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Kaydet' }))
  await waitFor(() => expect(screen.queryByRole('tab')).toBeNull())
  expect(notesApi.create).toHaveBeenCalledWith({ title: 'Yeni 1', content: 'Taslak' })
  fireEvent.click(tool('Yeni'))
  fireEvent.change(screen.getByLabelText('Not içeriği'), { target: { value: 'Atılacak' } })
  fireEvent.click(screen.getByRole('button', { name: 'Yeni 1 sekmesini kapat' }))
  fireEvent.click(screen.getByRole('button', { name: 'Kaydetme' }))
  expect(screen.queryByRole('tab')).toBeNull()
  const cleanUnload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(cleanUnload)
  expect(cleanUnload.defaultPrevented).toBe(false)
})

it('deletes the active persisted note through the toolbar', async () => {
  await setup(['one'])
  fireEvent.click(tool('Sil'))
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı sil' }))
  await waitFor(() => expect(screen.queryByRole('tab')).toBeNull())
  expect(notesApi.delete).toHaveBeenCalledWith('one')
  expect(localStorage.getItem(OPEN_TABS_KEY)).toBe('[]')
})

it.each(['menu', 'toolbar'])('saves edits to a restored note from the %s', async source => {
  await setup(['one'])
  fireEvent.change(screen.getByLabelText('Not içeriği'), { target: { value: 'Değişti' } })
  fireEvent.click((source === 'menu' ? menu : tool)('Kaydet'))
  await waitFor(() => expect(notesApi.update).toHaveBeenCalledWith('one', { title: note.title, content: 'Değişti' }))
  await waitFor(() => expect(screen.getByRole('tab').textContent).toBe(note.title))
})

it('connects edit menu commands to the active text editor', async () => {
  await setup(['one'])
  const original = Object.getOwnPropertyDescriptor(document, 'execCommand')
  const execute = vi.fn()
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execute })
  try {
    fireEvent.click(screen.getByText('Düzen'))
    for (const [label, command] of [['Geri Al', 'undo'], ['Yinele', 'redo'], ['Kes', 'cut'], ['Kopyala', 'copy'], ['Yapıştır', 'paste']]) {
      fireEvent.click(menu(label))
      expect(execute).toHaveBeenLastCalledWith(command)
      expect(document.activeElement).toBe(screen.getByLabelText('Not içeriği'))
    }
    fireEvent.click(menu('Tümünü Seç'))
    const input = screen.getByLabelText('Not içeriği') as HTMLTextAreaElement
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(note.content.length)
    fireEvent.click(screen.getByText('Görünüm'))
    expect(screen.getByText('Satır numaraları açık')).toBeTruthy()
  } finally {
    if (original) Object.defineProperty(document, 'execCommand', original)
    else Reflect.deleteProperty(document, 'execCommand')
  }
})

it('keeps a dirty tab after a failed close-save and allows retry', async () => {
  vi.mocked(notesApi.update).mockRejectedValueOnce(new Error('unavailable'))
  await setup(['one'])
  fireEvent.change(screen.getByLabelText('Not içeriği'), { target: { value: 'Korunacak' } })
  fireEvent.click(screen.getByRole('button', { name: 'Kayıtlı sekmesini kapat' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Kaydet' }))
  expect(await screen.findByText(/Not kaydedilemedi/)).toBeTruthy()
  expect((screen.getByLabelText('Not içeriği') as HTMLTextAreaElement).value).toBe('Korunacak')
  fireEvent.click(tool('Kaydet'))
  await waitFor(() => expect(screen.queryByRole('tab')).toBeNull())
})
