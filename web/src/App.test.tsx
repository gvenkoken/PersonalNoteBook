import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'
import { api, ApiError, configureApi } from './api/client'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('shows the API readiness', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
  render(<App />)
  expect(await screen.findByText('API: ready')).toBeTruthy()
})

it('turns problem details into ApiError', async () => {
  const body = JSON.stringify({ title: 'Validation failed', status: 400, errors: { name: ['Required'] } })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 400, headers: { 'Content-Type': 'application/problem+json' } })))
  const error = await api('/api/things').catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).problem.errors?.name).toEqual(['Required'])
})

it('sends the configured access token and nothing without one', async () => {
  const fetch = vi.fn(async () => new Response('[]', { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  configureApi({ credential: () => 'abc123' })
  await api('/api/things')
  configureApi({ credential: () => null })
  await api('/api/things')
  const headers = (fetch.mock.calls as unknown as [string, RequestInit][]).map(c => c[1].headers as Record<string, string>)
  expect(headers[0].Authorization).toBe(['Bearer', 'abc123'].join(' '))
  expect(headers[1].Authorization).toBeUndefined()
})
