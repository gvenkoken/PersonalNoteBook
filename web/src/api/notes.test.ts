import { afterEach, expect, it, vi } from 'vitest'
import { ApiError, configureApi, NoteTitleConflictError } from './client'
import { notesApi } from './notes'

afterEach(() => {
  vi.unstubAllGlobals()
  configureApi({ credential: () => null })
})

it('sends all five operations with the expected paths and JSON bodies', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('[]'))
    .mockResolvedValueOnce(new Response('{"id":"a"}'))
    .mockResolvedValueOnce(new Response('{"id":"a"}', { status: 201 }))
    .mockResolvedValueOnce(new Response('{"id":"a"}'))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  expect(await notesApi.list()).toEqual([])
  expect(await notesApi.get('a')).toEqual({ id: 'a' })
  const request = { title: 'Title', content: 'Text' }
  await notesApi.create(request)
  await notesApi.update('a', request)
  expect(await notesApi.delete('a')).toBeUndefined()
  expect(fetchMock.mock.calls.map(call => [call[0], call[1].method ?? 'GET']))
    .toEqual([
      ['/api/notes/', 'GET'], ['/api/notes/a', 'GET'], ['/api/notes/', 'POST'],
      ['/api/notes/a', 'PUT'], ['/api/notes/a', 'DELETE'],
    ])
  expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify(request))
  expect(fetchMock.mock.calls[3][1].body).toBe(JSON.stringify(request))
})

it('distinguishes title conflicts, other HTTP errors, and network failures', async () => {
  const networkError = new TypeError('Network unavailable')
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response('{"title":"Duplicate"}', { status: 409 }))
    .mockResolvedValueOnce(new Response('not json', { status: 500 }))
    .mockRejectedValueOnce(networkError))
  await expect(notesApi.create({ title: 'Title', content: '' })).rejects.toBeInstanceOf(NoteTitleConflictError)
  await expect(notesApi.get('a')).rejects.toMatchObject({ status: 500, problem: {} })
  await expect(notesApi.list()).rejects.toBe(networkError)
  expect(new NoteTitleConflictError({})).toBeInstanceOf(ApiError)
})
