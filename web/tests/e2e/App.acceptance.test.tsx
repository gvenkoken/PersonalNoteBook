import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { OPEN_TABS_KEY } from '../../src/state/editorTabs'
import { notesServer } from './notesServer'

let server: ReturnType<typeof notesServer>
beforeEach(() => {
  localStorage.clear()
  server = notesServer()
  vi.stubGlobal('fetch', server.fetch)
})
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function mount() {
  const view = render(<App />)
  await waitFor(() => expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('false'))
  return view
}
function tool(name: string) { fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name })) }
function edit(value: string) { fireEvent.change(screen.getByLabelText('Not içeriği'), { target: { value } }) }
function dialog(name: string) { fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name })) }
function shortcut() { fireEvent.keyDown(screen.getByLabelText('Not içeriği'), { key: 's', ctrlKey: true }) }
async function nameAndSave(title: string) {
  fireEvent.change(screen.getByLabelText('Not adı'), { target: { value: title } })
  dialog('Kaydet')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}
function close(title: string) { fireEvent.click(screen.getByRole('button', { name: `${title} sekmesini kapat` })) }
function content() { return (screen.getByLabelText('Not içeriği') as HTMLTextAreaElement).value }
function unload() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

it('saves with Ctrl+S, warns about duplicates, retains failed saves and supports all close/delete decisions', async () => {
  await mount()
  tool('Yeni'); edit('Süt al\nEkmek al'); shortcut()
  await nameAndSave('Alışveriş')
  expect([...server.notes.values()][0].content).toBe('Süt al\nEkmek al')
  expect(screen.getByRole('tab').textContent).toBe('Alışveriş')
  expect(unload()).toBe(false)

  tool('Yeni'); edit('İkinci'); shortcut()
  fireEvent.change(screen.getByLabelText('Not adı'), { target: { value: 'Alışveriş' } })
  dialog('Kaydet')
  expect(await screen.findByText('Bu adla bir not zaten var. Başka bir ad girin.')).toBeTruthy()
  expect(server.writes).toEqual(['POST'])
  await nameAndSave('İkinci')

  edit('Korunacak')
  server.failSave(); shortcut()
  expect(await screen.findByText(/Not kaydedilemedi/)).toBeTruthy()
  expect(content()).toBe('Korunacak')
  expect(screen.getByRole('tab', { selected: true }).textContent).toContain('*')
  expect(unload()).toBe(true)
  expect([...server.notes.values()][1].content).toBe('İkinci')
  close('İkinci'); dialog('Vazgeç')
  expect(content()).toBe('Korunacak')
  close('İkinci'); dialog('Kaydet')
  await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(1))
  expect([...server.notes.values()][1].content).toBe('Korunacak')
  edit('Atılacak'); close('Alışveriş'); dialog('Kaydetme')
  expect(screen.queryByRole('tab')).toBeNull()
  expect([...server.notes.values()][0].content).toBe('Süt al\nEkmek al')
  expect(unload()).toBe(false)

  // Open a saved note through the application, then cancel and confirm deletion.
  fireEvent.click(screen.getByText('Dosya'))
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Aç' }))
  const choices = await screen.findAllByRole('radio')
  fireEvent.click(choices[0]); dialog('Aç')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const selectedTitle = [...server.notes.values()].find(note => note.content === content())!.title
  tool('Sil')
  expect(screen.getByRole('dialog').textContent).toContain('Bu not kalıcı olarak silinecek')
  dialog('Vazgeç')
  expect(server.notes.size).toBe(2)
  expect(screen.getByRole('tab').textContent).toBe(selectedTitle)
  tool('Sil'); dialog('Kalıcı sil')
  await waitFor(() => expect(screen.queryByRole('tab')).toBeNull())
  expect(server.notes.size).toBe(1)
  expect(server.writes.at(-1)).toBe('DELETE')
})

it('reopens saved tabs in order and silently removes a note deleted between sessions', async () => {
  let view = await mount()
  for (const title of ['Bir', 'İki', 'Üç']) {
    tool('Yeni'); edit(title); shortcut(); await nameAndSave(title)
  }
  const ids = [...server.notes.keys()]
  expect(JSON.parse(localStorage.getItem(OPEN_TABS_KEY)!)).toEqual(ids)
  view.unmount()
  server.notes.delete(ids[1])
  view = await mount()
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Bir', 'Üç'])
  expect(JSON.parse(localStorage.getItem(OPEN_TABS_KEY)!)).toEqual([ids[0], ids[2]])
  expect(screen.queryByRole('alert')).toBeNull()
  view.unmount()
})

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

it('downloads the exact JSON/HTML preview, counts 15 characters and escapes standalone HTML', async () => {
  await mount()
  tool('Yeni'); edit('Süt al\nEkmek al'); shortcut(); await nameAndSave('Liste <&>')
  expect(screen.getByLabelText('Editör durumu').textContent).toContain('15 karakter')
  const blobs: Blob[] = []
  const filenames: string[] = []
  const create = vi.fn((blob: Blob) => { blobs.push(blob); return 'blob:acceptance' })
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = create
    static revokeObjectURL = revoke
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filenames.push(this.download) })
  fireEvent.click(screen.getByText('Dönüştür'))
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'JSON' }))
  const json = (await screen.findByLabelText('JSON kaynağı')).textContent!
  expect(JSON.parse(json)).toMatchObject({ content: 'Süt al\nEkmek al', charCount: 15, lineCount: 2 })
  fireEvent.click(screen.getByRole('button', { name: /JSON indir/ }))
  expect(await readBlob(blobs[0])).toBe(json)
  fireEvent.change(screen.getByLabelText('Biçim'), { target: { value: 'html' } })
  edit('<script>alert("x")</script> & \'Türkçe\' 😀👩‍💻')
  const html = (await screen.findByLabelText('HTML kaynağı')).textContent!
  expect(html).toContain('<title>Liste &lt;&amp;&gt;</title>')
  expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Türkçe&#39;')
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  expect(parsed.querySelector('script')).toBeNull()
  expect(parsed.querySelector('pre')?.textContent).toBe(content())
  fireEvent.click(screen.getByRole('button', { name: /HTML indir/ }))
  expect(await readBlob(blobs[1])).toBe(html)
  expect(filenames).toEqual(['Liste _&_.json', 'Liste _&_.html'])
  expect(blobs.map(blob => blob.type)).toEqual(['application/json;charset=utf-8', 'text/html;charset=utf-8'])
  expect(revoke).toHaveBeenCalledTimes(2)
})
