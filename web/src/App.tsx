import { useEffect, useState } from 'react'

type Status = 'checking' | 'ready' | 'unavailable'

export function App() {
  const [status, setStatus] = useState<Status>('checking')
  useEffect(() => {
    let active = true
    fetch('/health/ready')
      .then((r) => active && setStatus(r.ok ? 'ready' : 'unavailable'))
      .catch(() => active && setStatus('unavailable'))
    return () => {
      active = false
    }
  }, [])
  return (
    <main>
      <h1>NotDefteri</h1>
      <p role="status">API: {status}</p>
    </main>
  )
}
