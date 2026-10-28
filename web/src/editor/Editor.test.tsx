import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { Editor } from './Editor'
import { EditorTabStore } from '../state/editorTabs'
import { countChars } from '../conversion'

afterEach(cleanup)
function setup() {
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  render(<Editor store={store} />)
  return store
}
function create() {
  fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Yeni' }))
}

it('shows the menus and labeled tools in workspace order', () => {
  setup()
  const navigation = screen.getByRole('navigation', { name: 'Ana menü' })
  expect(Array.from(navigation.querySelectorAll('summary')).map(item => item.textContent))
    .toEqual(['Dosya', 'Düzen', 'Görünüm', 'Dönüştür'])
  const toolbar = screen.getByRole('toolbar', { name: 'Not araçları' })
  expect(within(toolbar).getAllByRole('button').map(item => item.textContent?.trim()))
    .toEqual(['＋ Yeni', '▣ Kaydet', '× Sil'])
  expect(navigation.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const summaries = navigation.querySelectorAll('summary')
  fireEvent.click(summaries[1])
  for (const name of ['Geri Al', 'Yinele', 'Kes', 'Kopyala', 'Yapıştır', 'Tümünü Seç']) {
    expect(within(navigation).getByRole('button', { name })).toBeTruthy()
  }
})

it('creates numbered empty tabs and describes unsaved changes', () => {
  setup()
  expect(screen.getByText('Hiç açık not yok')).toBeTruthy()
  create()
  expect(screen.getByRole('tab', { name: 'Yeni 1' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Not' } })
  expect(screen.getByRole('tab').textContent).toContain('*')
  expect(screen.getByRole('tab').title).toContain('Kaydedilmemiş değişiklikler')
  create()
  expect(screen.getByRole('tab', { name: 'Yeni 2' })).toBeTruthy()
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
})

it('uses shared character counting, line numbers and cursor coordinates', () => {
  setup()
  create()
  const input = screen.getByRole('textbox') as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: 'Süt al\nEkmek al' } })
  expect(within(screen.getByRole('list', { name: 'Satır numaraları' })).getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByText('15 karakter')).toBeTruthy()
  input.setSelectionRange(9, 9)
  fireEvent.select(input)
  expect(screen.getByText('Satır 2, Sütun 3')).toBeTruthy()
  const content = '👩‍💻\n'
  fireEvent.change(input, { target: { value: content } })
  expect(screen.getByText(`${countChars(content)} karakter`)).toBeTruthy()
})

it('switches tabs with arrow keys while preserving their content', () => {
  setup()
  create()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'İlk not' } })
  create()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Yeni 2' }), { key: 'ArrowLeft' })
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('İlk not')
  expect(document.activeElement).toBe(screen.getAllByRole('tab')[0])
})

it('shows loading and the full saved title and update timestamp', () => {
  const store = new EditorTabStore({ getItem: () => null, setItem: () => {} })
  store.open({ id: 'one', title: 'Uzun not başlığı', content: '', createdAt: '', updatedAt: '2026-10-28T10:00:00Z' })
  render(<Editor store={store} loading updatedAt={{ one: '2026-10-28T10:00:00Z' }} />)
  expect(screen.getByText('Notlar yükleniyor…')).toBeTruthy()
  expect(screen.getByRole('tab').title).toBe('Uzun not başlığı\nGüncelleme: 2026-10-28T10:00:00Z')
})
