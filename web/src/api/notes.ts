import { api } from './client'

export interface NoteSummary {
  id: string
  title: string
  updatedAt: string
}

export interface Note extends NoteSummary {
  content: string
  createdAt: string
}

export interface NoteRequest {
  title: string
  content: string
}

const path = (id: string) => `/api/notes/${encodeURIComponent(id)}`

export const notesApi = {
  list: () => api<NoteSummary[]>('/api/notes/'),
  get: (id: string) => api<Note>(path(id)),
  create: (note: NoteRequest) => api<Note>('/api/notes/', {
    method: 'POST', body: JSON.stringify(note),
  }),
  update: (id: string, note: NoteRequest) => api<Note>(path(id), {
    method: 'PUT', body: JSON.stringify(note),
  }),
  delete: (id: string) => api<void>(path(id), { method: 'DELETE' }),
}
