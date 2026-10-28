import { describe, expect, it } from 'vitest'
import { countChars, exportFileName, normalizeNewlines, splitLines, toNoteHtml, toNoteJson } from './index'
import type { Note } from './index'

const note: Note = {
  id: 'note-1',
  title: 'Alışveriş',
  content: 'Süt al\nEkmek al',
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-02T10:00:00Z',
}

describe('text normalization and counting', () => {
  it('normalizes CRLF and lone CR without changing existing LF', () => {
    expect(normalizeNewlines('a\r\nb\rc\n')).toBe('a\nb\nc\n')
    expect(countChars('a\r\nb\rc\n')).toBe(6)
    expect(splitLines('a\r\nb\rc\n')).toEqual(['a', 'b', 'c', ''])
  })

  it.each([
    ['Süt al\nEkmek al', 15],
    ['çğıöşüÇĞİÖŞÜ', 12],
    ['😀', 1],
    ['👨‍👩‍👧‍👦', 7],
    ['e\u0301', 2],
    ['', 0],
  ])('counts code points in %j', (text, expected) => {
    expect(countChars(text)).toBe(expected)
  })

  it('preserves empty lines, including empty content', () => {
    expect(splitLines('')).toEqual([''])
    expect(splitLines('\n\n')).toEqual(['', '', ''])
  })
})

describe('JSON export', () => {
  it('serializes exactly the export fields with shared counts', () => {
    expect(JSON.parse(toNoteJson(note))).toEqual({
      ...note,
      lines: ['Süt al', 'Ekmek al'],
      lineCount: 2,
      charCount: 15,
    })
  })

  it('uses normalized content for lines and counts without mutating the note', () => {
    const input = { ...note, content: '😀\r\n👨‍👩‍👧‍👦\r' }
    const result = JSON.parse(toNoteJson(input))
    expect(result.content).toBe('😀\n👨‍👩‍👧‍👦\n')
    expect(result.lines).toEqual(['😀', '👨‍👩‍👧‍👦', ''])
    expect(result.lineCount).toBe(3)
    expect(result.charCount).toBe(countChars(input.content))
    expect(input.content).toBe('😀\r\n👨‍👩‍👧‍👦\r')
  })
})

describe('HTML export', () => {
  it('escapes all five special characters in the title and pre body', () => {
    const text = '<script>alert("x" & \'y\')</script>'
    const html = toNoteHtml({ ...note, title: text, content: text })
    const escaped = '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;'
    expect(html).toContain(`<title>${escaped}</title>`)
    expect(html).toContain(`<pre>\n${escaped}</pre>`)
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.doctype?.name).toBe('html')
    expect(document.querySelector('meta')?.getAttribute('charset')).toBe('utf-8')
    expect(document.querySelectorAll('script')).toHaveLength(0)
    expect(document.title).toBe(text)
    expect(document.querySelector('pre')?.textContent).toBe(text)
  })

  it.each(['', '\nfirst\n', '\n\n', '</pre><img src=x onerror="alert(1)">'])('preserves literal body text %j', content => {
    const document = new DOMParser().parseFromString(toNoteHtml({ ...note, content }), 'text/html')
    expect(document.querySelector('pre')?.textContent).toBe(content)
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })

  it('normalizes newlines in the HTML body', () => {
    const document = new DOMParser().parseFromString(toNoteHtml({ ...note, content: '\r\na\rb' }), 'text/html')
    expect(document.querySelector('pre')?.textContent).toBe('\na\nb')
  })
})

describe('export filenames', () => {
  it.each(['json', 'html'] as const)('uses the note title and .%s extension', format => {
    expect(exportFileName('Türkçe not 😀', format)).toBe(`Türkçe not 😀.${format}`)
  })

  it.each(['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\u0000', '\n'])('replaces invalid character %j', character => {
    expect(exportFileName(`a${character}b`, 'json')).toBe('a_b.json')
    expect(exportFileName(`a${character}b`, 'html')).toBe('a_b.html')
  })

  it('handles empty titles, trailing dots and reserved device names', () => {
    expect(exportFileName(' ... ', 'json')).toBe('note.json')
    expect(exportFileName('not. ', 'html')).toBe('not.html')
    expect(exportFileName('CON', 'json')).toBe('_CON.json')
    expect(exportFileName('lpt1.txt', 'html')).toBe('_lpt1.txt.html')
  })
})
