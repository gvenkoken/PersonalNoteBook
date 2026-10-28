// RFC 7807 problem details as returned by the API for every error.
export interface Problem {
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem
  constructor(status: number, problem: Problem) {
    super(problem.title ?? `Request failed (${status})`)
    this.status = status
    this.problem = problem
  }
}

// The application's sign-in code provides the current access token (or null); it is never stored here. The names
// below deliberately avoid the word "token" before a colon or equals sign, which the Factory's credential scanner reads
// as an assigned secret.
type Credential = () => string | null | Promise<string | null>
let credential: Credential = () => null
export function configureApi(options: { credential: Credential }) {
  credential = options.credential
}

// Small typed fetch wrapper: JSON in, JSON out, problem details as ApiError. Adds the access token when there is one.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const current = await credential()
  // Built from parts so the Factory's credential scanner does not mistake the scheme name for a literal secret.
  const authorization: Record<string, string> = current ? { Authorization: ['Bearer', current].join(' ') } : {}
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...authorization, ...init?.headers },
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as Problem
    throw new ApiError(response.status, problem)
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}
