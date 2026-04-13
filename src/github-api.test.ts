import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearApiCache, closePR, deleteBranch, postPRComment } from './github-api'

/* Helpers to build minimal fetch Response objects. */
function okResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const TOKEN = 'ghp_test_token'
const REPO = 'owner/repo'
const PR_NUMBER = 42
const BRANCH = 'feat/my-feature'

afterEach(() => {
  vi.restoreAllMocks()
  clearApiCache()
})

/* ── clearApiCache ── */
describe('clearApiCache', () => {
  it('can be called without throwing', () => {
    expect(() => clearApiCache()).not.toThrow()
  })
})

/* ── closePR ── */
describe('closePR', () => {
  it('calls the correct GitHub API endpoint with PATCH and state=closed', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({}))

    await closePR(REPO, PR_NUMBER, TOKEN)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.github.com/repos/${REPO}/pulls/${PR_NUMBER}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ state: 'closed' })
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${TOKEN}`)
  })

  it('resolves without a value on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({}))
    await expect(closePR(REPO, PR_NUMBER, TOKEN)).resolves.toBeUndefined()
  })

  it('throws "Invalid GitHub token." on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(401))
    await expect(closePR(REPO, PR_NUMBER, TOKEN)).rejects.toThrow('Invalid GitHub token.')
  })

  it('throws forbidden message on 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(403))
    await expect(closePR(REPO, PR_NUMBER, TOKEN)).rejects.toThrow('Forbidden')
  })

  it('throws a generic error message on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(500))
    await expect(closePR(REPO, PR_NUMBER, TOKEN)).rejects.toThrow('Failed to close PR: 500')
  })

  it('throws "Invalid repository name" for a malformed repo string', async () => {
    await expect(closePR('no-slash', PR_NUMBER, TOKEN)).rejects.toThrow('Invalid repository name')
  })
})

/* ── deleteBranch ── */
describe('deleteBranch', () => {
  it('calls DELETE on the git refs endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await deleteBranch(REPO, BRANCH, TOKEN)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const encodedBranch = encodeURIComponent(BRANCH)
    expect(url).toBe(`https://api.github.com/repos/${REPO}/git/refs/heads/${encodedBranch}`)
    expect(init.method).toBe('DELETE')
  })

  it('resolves without a value on 204 success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await expect(deleteBranch(REPO, BRANCH, TOKEN)).resolves.toBeUndefined()
  })

  it('throws protected error on 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(422))
    await expect(deleteBranch(REPO, BRANCH, TOKEN)).rejects.toThrow(
      'Branch is protected and cannot be deleted.',
    )
  })

  it('throws forbidden message on 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(403))
    await expect(deleteBranch(REPO, BRANCH, TOKEN)).rejects.toThrow('Forbidden')
  })

  it('throws "Invalid GitHub token." on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(401))
    await expect(deleteBranch(REPO, BRANCH, TOKEN)).rejects.toThrow('Invalid GitHub token.')
  })

  it('throws "not found" error on 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(404))
    await expect(deleteBranch(REPO, BRANCH, TOKEN)).rejects.toThrow(
      `Branch "${BRANCH}" not found.`,
    )
  })

  it('throws a generic error on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(500))
    await expect(deleteBranch(REPO, BRANCH, TOKEN)).rejects.toThrow('Failed to delete branch: 500')
  })

  it('throws "Invalid repository name" for a malformed repo string', async () => {
    await expect(deleteBranch('no-slash', BRANCH, TOKEN)).rejects.toThrow('Invalid repository name')
  })

  it('URL-encodes branch names that contain slashes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    await deleteBranch(REPO, 'feat/slash/branch', TOKEN)
    const [url] = fetchSpy.mock.calls[0] as [string]
    expect(url).toContain('feat%2Fslash%2Fbranch')
  })
})

/* ── postPRComment ── */
describe('postPRComment', () => {
  const commentPayload = {
    id: 99,
    user: { login: 'dev-user', avatar_url: 'https://avatars.example.com/1' },
    body: 'LGTM!',
    created_at: '2026-03-01T10:00:00Z',
  }

  it('sends a POST to the issues comments endpoint with the right body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(commentPayload))

    await postPRComment(REPO, PR_NUMBER, TOKEN, 'LGTM!')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.github.com/repos/${REPO}/issues/${PR_NUMBER}/comments`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ body: 'LGTM!' })
  })

  it('returns a PRComment object on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(commentPayload))

    const result = await postPRComment(REPO, PR_NUMBER, TOKEN, 'LGTM!')

    expect(result).toMatchObject({
      id: 99,
      author: 'dev-user',
      authorAvatar: 'https://avatars.example.com/1',
      body: 'LGTM!',
      createdAt: '2026-03-01T10:00:00Z',
      isReview: false,
    })
  })

  it('falls back to "ghost" when user is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ ...commentPayload, user: null }),
    )
    const result = await postPRComment(REPO, PR_NUMBER, TOKEN, 'hello')
    expect(result.author).toBe('ghost')
    expect(result.authorAvatar).toBe('')
  })

  it('throws forbidden message on 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(403))
    await expect(postPRComment(REPO, PR_NUMBER, TOKEN, 'text')).rejects.toThrow(
      'Forbidden: token may not have write access',
    )
  })

  it('throws "Invalid GitHub token." on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(401))
    await expect(postPRComment(REPO, PR_NUMBER, TOKEN, 'text')).rejects.toThrow(
      'Invalid GitHub token.',
    )
  })

  it('throws a generic error on other HTTP failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(422))
    await expect(postPRComment(REPO, PR_NUMBER, TOKEN, 'text')).rejects.toThrow(
      'Failed to post comment: 422',
    )
  })

  it('throws "Invalid repository name" for a malformed repo string', async () => {
    await expect(postPRComment('no-slash', PR_NUMBER, TOKEN, 'text')).rejects.toThrow(
      'Invalid repository name',
    )
  })
})

describe('clearApiCache invalidation', () => {
  beforeEach(() => clearApiCache())

  it('does not retain entries between tests', async () => {
    // Return a fresh Response on every call so the body is never "already read"
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(okResponse({ login: 'user-a' })),
    )

    const { fetchCurrentUser } = await import('./github-api')
    await fetchCurrentUser('token-a')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // clearApiCache is called, second call should go to network again
    clearApiCache()
    await fetchCurrentUser('token-a')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
