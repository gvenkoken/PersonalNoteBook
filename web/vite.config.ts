import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The API runs on http://127.0.0.1:5080 in development (dotnet run --urls ...); /api and /health are proxied to it.
const api = 'http://127.0.0.1:5080'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: api }, '/health': { target: api } } },
  test: { environment: 'jsdom' },
})
