import { ApiError } from '../api/client'
import { notesApi } from '../api/notes'
import type { Note } from '../api/notes'

export const OPEN_TABS_KEY = 'notdefteri.openNoteIds'

export interface EditorTab {
  readonly key: string
  readonly noteId: string | null
  readonly title: string
  readonly content: string
  readonly dirty: boolean
  readonly cursor: Readonly<{ line: number; column: number }>
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

/** Snapshot order is tab order. Browser storage contains only saved ids. */
export class EditorTabStore {
  private tabs: readonly EditorTab[] = []
  private listeners = new Set<() => void>()
  private nextKey = 1
  private revision = 0

  constructor(
    private readonly storage: Storage = localStorage,
    private readonly loadNote: (id: string) => Promise<Note> = notesApi.get,
  ) {}

  getSnapshot = (): readonly EditorTab[] => this.tabs

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(tabs: readonly EditorTab[]) {
    this.tabs = Object.freeze(tabs.map(tab => Object.freeze({
      ...tab, cursor: Object.freeze({ ...tab.cursor }),
    })))
    this.revision++
    try {
      this.storage.setItem(OPEN_TABS_KEY, JSON.stringify(
        tabs.flatMap(tab => tab.noteId === null ? [] : [tab.noteId]),
      ))
    } catch { /* Editing remains available when storage is unavailable. */ }
    this.listeners.forEach(listener => listener())
  }

  private fromNote(note: Note): EditorTab {
    return {
      key: `tab-${this.nextKey++}`, noteId: note.id, title: note.title,
      content: note.content, dirty: false, cursor: { line: 1, column: 1 },
    }
  }

  create(): string {
    let number = 1
    while (this.tabs.some(tab => tab.title === `Yeni ${number}`)) number++
    const key = `tab-${this.nextKey++}`
    this.publish([...this.tabs, {
      key, noteId: null, title: `Yeni ${number}`, content: '', dirty: false,
      cursor: { line: 1, column: 1 },
    }])
    return key
  }

  open(note: Note): string {
    const existing = this.tabs.find(tab => tab.noteId === note.id)
    if (existing) return existing.key
    const tab = this.fromNote(note)
    this.publish([...this.tabs, tab])
    return tab.key
  }

  setContent(key: string, content: string) {
    this.publish(this.tabs.map(tab => tab.key === key && tab.content !== content
      ? { ...tab, content, dirty: true } : tab))
  }

  setCursor(key: string, line: number, column: number) {
    if (!Number.isInteger(line) || !Number.isInteger(column) || line < 1 || column < 1)
      throw new RangeError('Cursor coordinates must be positive integers')
    this.publish(this.tabs.map(tab => tab.key === key ? { ...tab, cursor: { line, column } } : tab))
  }

  markSaved(key: string, note: Note) {
    if (this.tabs.some(tab => tab.key !== key && tab.noteId === note.id))
      throw new Error('Note is already open')
    this.publish(this.tabs.map(tab => tab.key === key ? {
      ...tab, noteId: note.id, title: note.title, content: note.content, dirty: false,
    } : tab))
  }

  close(key: string) {
    this.publish(this.tabs.filter(tab => tab.key !== key))
  }

  move(key: string, index: number) {
    const tab = this.tabs.find(tab => tab.key === key)
    if (!tab) return
    const tabs = this.tabs.filter(item => item.key !== key)
    tabs.splice(Math.max(0, Math.min(tabs.length, index)), 0, tab)
    this.publish(tabs)
  }

  /** Call at startup. Edits made during loading take precedence over restoration. */
  async restore(): Promise<void> {
    const revision = this.revision
    let ids: string[]
    try {
      const value: unknown = JSON.parse(this.storage.getItem(OPEN_TABS_KEY) ?? '[]')
      ids = Array.isArray(value) ? [...new Set(value.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      ))] : []
    } catch { ids = [] }
    const notes = await Promise.all(ids.map(async id => {
      try { return await this.loadNote(id) }
      catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    }))
    if (this.revision !== revision) return
    this.publish(notes.flatMap(note => note === null ? [] : [this.fromNote(note)]))
  }
}
