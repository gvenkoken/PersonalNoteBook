import { vi } from 'vitest'
import type { Note, NoteRequest } from '../../src/api/notes'

/** Only fetch is replaced; App uses its real API client and state store. */
export function notesServer() {
  const notes = new Map<string, Note>()
  const writes: string[] = []
  let sequence = 0
  let fail = false
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(/\/$/, '')
    const method = init?.method ?? 'GET'
    if (path === '/health/ready' && method === 'GET') return new Response('Healthy')
    if (!path.startsWith('/api/notes')) throw new Error(`Unexpected request: ${path}`)
    const id = decodeURIComponent(path.slice('/api/notes/'.length))
    if (method === 'GET') {
      if (path === '/api/notes') return json([...notes.values()])
      return notes.has(id) ? json(notes.get(id)) : json({ status: 404 }, 404)
    }
    writes.push(method)
    if (method === 'DELETE') {
      notes.delete(id)
      return new Response(null, { status: 204 })
    }
    if (method !== 'POST' && method !== 'PUT') throw new Error(`Unexpected method: ${method}`)
    if (fail) { fail = false; return json({ status: 500 }, 500) }
    const request = JSON.parse(String(init?.body)) as NoteRequest
    if ([...notes.values()].some(note => note.title === request.title && note.id !== id)) return json({ status: 409 }, 409)
    const existing = notes.get(id)
    if (method === 'PUT' && !existing) return json({ status: 404 }, 404)
    const note: Note = { ...request, id: existing?.id ?? `note-${++sequence}`,
      createdAt: existing?.createdAt ?? '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }
    notes.set(note.id, note)
    return json(note, method === 'POST' ? 201 : 200)
  })
  return { notes, writes, fetch, failSave: () => { fail = true } }
}
