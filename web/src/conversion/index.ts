export interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

/** Count Unicode code points after newline normalization, including each LF. */
export function countChars(text: string): number {
  return Array.from(normalizeNewlines(text)).length
}

/** Empty content has one empty line; a final newline adds an empty line. */
export function splitLines(text: string): string[] {
  return normalizeNewlines(text).split('\n')
}

/** Serialized output can be shared directly by preview and download. */
export function toNoteJson(note: Note): string {
  const content = normalizeNewlines(note.content)
  const lines = splitLines(content)
  return JSON.stringify({
    id: note.id,
    title: note.title,
    content,
    lines,
    lineCount: lines.length,
    charCount: countChars(content),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }, null, 2)
}

function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, character => entities[character])
}

export function toNoteHtml(note: Note): string {
  const title = escapeHtml(note.title)
  const content = escapeHtml(normalizeNewlines(note.content))
  // The extra LF is consumed by HTML's pre parsing rule, preserving a leading LF in content.
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body>
<pre>\n${content}</pre>
</body>
</html>`
}

export function exportFileName(title: string, format: 'json' | 'html'): string {
  const sanitized = title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').trim().replace(/[. ]+$/g, '')
  const name = sanitized || 'note'
  // Windows reserves these device names even when an extension is present.
  const safeName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name
  return `${safeName}.${format}`
}
