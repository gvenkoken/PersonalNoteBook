import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { notesApi } from '../../api/notes'
import { exportFileName, toNoteHtml, toNoteJson } from '../../conversion'
import { EditorTabStore } from '../../state/editorTabs'
import { ExportPreviewEditor } from './ExportPreviewEditor'
import { ExportPreviewPanel } from './ExportPreviewPanel'
import type { ExportFormat } from './ExportPreviewPanel'

const note = {
  id: 'note-1', title: 'Örnek / not', content: '<b>x</b>\r\n😀',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shows all JSON fields and renders escaped HTML as inert source text', () => {
  const onFormatChange = vi.fn()
  const onClose = vi.fn()
  const { container, rerender } = render(<ExportPreviewPanel note={note} format="json" onFormatChange={onFormatChange} onClose={onClose} />)
  expect(JSON.parse(screen.getByLabelText('JSON kaynağı').textContent!)).toEqual({
    ...note, content: '<b>x</b>\n😀', lines: ['<b>x</b>', '😀'], lineCount: 2, charCount: 10,
  })
  fireEvent.change(screen.getByLabelText('Biçim'), { target: { value: 'html' } })
  expect(onFormatChange).toHaveBeenCalledWith('html')
  rerender(<ExportPreviewPanel note={note} format="html" onFormatChange={onFormatChange} onClose={onClose} />)
  expect(screen.getByLabelText('HTML kaynağı').textContent).toBe(toNoteHtml(note))
  expect(screen.getByLabelText('HTML kaynağı').textContent).toContain('&lt;b&gt;x&lt;/b&gt;')
  expect(container.querySelector('b, iframe, script')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Önizlemeyi kapat' }))
  expect(onClose).toHaveBeenCalledOnce()
})

it.each<ExportFormat>(['json', 'html'])('downloads exactly the preview bytes and generated filename for %s', async format => {
  const createObjectURL = vi.fn(() => 'blob:preview')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL
    static revokeObjectURL = revokeObjectURL
  })
  let filename = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    filename = this.download
    expect(this.href).toBe('blob:preview')
  })
  render(<ExportPreviewPanel note={note} format={format} onFormatChange={() => {}} onClose={() => {}} />)
  const output = screen.getByLabelText(`${format.toUpperCase()} kaynağı`).textContent!
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${format.toUpperCase()} indir`) }))
  const blob = (createObjectURL.mock.calls as unknown as [Blob][])[0][0]
  // Modern Blob implementations expose their bytes directly. Keep FileReader
  // support for DOM environments that implement only the older Blob API.
  const bytes = typeof blob.arrayBuffer === 'function'
    ? await blob.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
  expect(Array.from(new Uint8Array(bytes))).toEqual(Array.from(new TextEncoder().encode(output)))
  expect(output).toBe(format === 'json' ? toNoteJson(note) : toNoteHtml(note))
  expect(filename).toBe(exportFileName(note.title, format))
  expect(blob.type).toBe(format === 'json' ? 'application/json;charset=utf-8' : 'text/html;charset=utf-8')
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  expect(document.querySelector('a[download]')).toBeNull()
})

it('shows an informative empty state with no download command', () => {
  render(<ExportPreviewPanel note={null} format="json" onFormatChange={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('status').textContent).toContain('bir not seçin')
  expect(screen.queryByRole('button', { name: /indir/ })).toBeNull()
})

it('opens one panel from the conversion menu and follows tab selection and edits', async () => {
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  const first = store.create()
  const second = store.create()
  store.setContent(first, 'ilk')
  store.setContent(second, '<b>x</b>')
  render(<ExportPreviewEditor store={store} />)
  fireEvent.click(screen.getByText('Dönüştür'))
  fireEvent.click(screen.getByRole('button', { name: 'JSON' }))
  expect(screen.getByLabelText('JSON kaynağı').textContent).toContain('ilk')
  fireEvent.click(screen.getByRole('tab', { name: /Yeni 2/ }))
  await waitFor(() => expect(screen.getByLabelText('JSON kaynağı').textContent).toContain('<b>x</b>'))
  fireEvent.change(screen.getByLabelText('Not içeriği'), { target: { value: 'değişti' } })
  expect(screen.getByLabelText('JSON kaynağı').textContent).toContain('değişti')
  fireEvent.click(screen.getByRole('button', { name: 'HTML' }))
  expect(screen.getAllByRole('complementary')).toHaveLength(1)
  expect(screen.getByLabelText('HTML kaynağı').textContent).toContain('değişti')
  act(() => { store.close(first); store.close(second) })
  expect(await screen.findByText('Önizlemek için bir not seçin.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Önizlemeyi kapat' }))
  expect(screen.queryByRole('complementary')).toBeNull()
})

it('uses server metadata and current edited content for a saved note', async () => {
  vi.spyOn(notesApi, 'get').mockResolvedValue(note)
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  const key = store.open(note)
  store.setContent(key, 'yerel değişiklik')
  render(<ExportPreviewEditor store={store} />)
  fireEvent.click(screen.getByText('Dönüştür'))
  fireEvent.click(screen.getByRole('button', { name: 'JSON' }))
  const source = await screen.findByLabelText('JSON kaynağı')
  expect(JSON.parse(source.textContent!)).toMatchObject({
    id: note.id, title: note.title, content: 'yerel değişiklik', createdAt: note.createdAt, updatedAt: note.updatedAt,
  })
})

it('places the panel after the editor in a single column at 390px', () => {
  // npm runs tests from the web package; import.meta.url can be a browser URL in jsdom.
  const css = readFileSync('src/features/export-preview/export-preview.css', 'utf8')
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  store.create()
  const { container } = render(<ExportPreviewEditor store={store} />)
  fireEvent.click(screen.getByText('Dönüştür'))
  fireEvent.click(screen.getByRole('button', { name: 'JSON' }))
  const layout = container.querySelector('.export-preview-layout.export-preview-open')!
  expect(layout.children[0].classList.contains('export-preview-editor')).toBe(true)
  expect(layout.children[1]).toBe(screen.getByRole('complementary'))
  expect(css).toMatch(/@media\s*\(max-width:\s*700px\)/)
  const mobile = css.slice(css.indexOf('@media'))
  expect(mobile).toContain('grid-template-columns: minmax(0, 1fr)')
  expect(mobile).toContain('grid-row: 2')
  expect(css).toContain('overflow-x: auto')
  expect(css).toContain('white-space: pre')
})
