import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadRepoState,
  saveRepoState,
  loadToken,
  saveToken,
  loadTheme,
  saveTheme,
  loadMode,
  saveMode,
  loadCopilotTarget,
  saveCopilotTarget,
} from './storage'

const REPO_KEY = 'prpulse.gh.devcp.dashboard.repositories'
const TOKEN_KEY = 'prpulse.gh.devcp.dashboard.token'
const TOKEN_SESSION_KEY = 'prpulse.gh.devcp.dashboard.token.session'
const TOKEN_PERSISTENT_KEY = 'prpulse.gh.devcp.dashboard.token.encrypted'
const THEME_KEY = 'prpulse.gh.devcp.dashboard.theme'
const MODE_KEY = 'prpulse.gh.devcp.dashboard.mode'
const COPILOT_TARGET_KEY = 'prpulse.gh.devcp.dashboard.copilotTarget'

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

/* ── loadRepoState ── */
describe('loadRepoState', () => {
  it('returns defaultRepos when localStorage is empty', () => {
    const result = loadRepoState(['a/b', 'c/d'])
    expect(result).toEqual({ repos: ['a/b', 'c/d'], selectedRepos: ['a/b', 'c/d'] })
  })

  it('returns parsed state when valid JSON is stored', () => {
    localStorage.setItem(
      REPO_KEY,
      JSON.stringify({ repos: ['x/y'], selectedRepos: ['x/y'] }),
    )
    expect(loadRepoState([])).toEqual({ repos: ['x/y'], selectedRepos: ['x/y'] })
  })

  it('filters out selectedRepos that are not in repos', () => {
    localStorage.setItem(
      REPO_KEY,
      JSON.stringify({ repos: ['a/b'], selectedRepos: ['a/b', 'gone/repo'] }),
    )
    const result = loadRepoState([])
    expect(result.selectedRepos).toEqual(['a/b'])
  })

  it('falls back to defaultRepos for invalid JSON', () => {
    localStorage.setItem(REPO_KEY, '{not valid json')
    expect(loadRepoState(['fallback/repo'])).toEqual({
      repos: ['fallback/repo'],
      selectedRepos: ['fallback/repo'],
    })
  })

  it('falls back to defaultRepos when repos array is empty', () => {
    localStorage.setItem(
      REPO_KEY,
      JSON.stringify({ repos: [], selectedRepos: [] }),
    )
    expect(loadRepoState(['fallback/repo'])).toEqual({
      repos: ['fallback/repo'],
      selectedRepos: ['fallback/repo'],
    })
  })

  it('falls back when repos is missing', () => {
    localStorage.setItem(REPO_KEY, JSON.stringify({ selectedRepos: ['a/b'] }))
    expect(loadRepoState(['fallback/repo'])).toEqual({
      repos: ['fallback/repo'],
      selectedRepos: ['fallback/repo'],
    })
  })
})

/* ── saveRepoState ── */
describe('saveRepoState', () => {
  it('writes JSON to localStorage', () => {
    saveRepoState({ repos: ['a/b'], selectedRepos: [] })
    const raw = localStorage.getItem(REPO_KEY)
    expect(JSON.parse(raw!)).toEqual({ repos: ['a/b'], selectedRepos: [] })
  })

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveRepoState({ repos: [], selectedRepos: [] })).not.toThrow()
  })
})

/* ── loadToken ── */
describe('loadToken', () => {
  it('returns empty string when nothing is stored', async () => {
    await expect(loadToken()).resolves.toBe('')
  })

  it('returns the stored session token', async () => {
    sessionStorage.setItem(TOKEN_SESSION_KEY, 'ghp_abc123')
    await expect(loadToken()).resolves.toBe('ghp_abc123')
  })

  it('falls back to encrypted localStorage token and hydrates sessionStorage', async () => {
    await saveToken('ghp_persisted')
    sessionStorage.removeItem(TOKEN_SESSION_KEY)

    await expect(loadToken()).resolves.toBe('ghp_persisted')
    expect(sessionStorage.getItem(TOKEN_SESSION_KEY)).toBe('ghp_persisted')
  })

  it('returns empty string when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('security error')
    })
    await expect(loadToken()).resolves.toBe('')
  })
})

/* ── saveToken ── */
describe('saveToken', () => {
  it('saves a non-empty token to sessionStorage and localStorage, plus a hash fingerprint', async () => {
    await saveToken('ghp_test')
    expect(sessionStorage.getItem(TOKEN_SESSION_KEY)).toBe('ghp_test')
    expect(localStorage.getItem(TOKEN_PERSISTENT_KEY)).toMatch(/^v1:/)
    expect(localStorage.getItem(TOKEN_PERSISTENT_KEY)).not.toBe('ghp_test')
    expect(localStorage.getItem(TOKEN_KEY)).toMatch(/^(sha256:[0-9a-f]{64}|fnv1a32:[0-9a-f]{8})$/)
    expect(localStorage.getItem(TOKEN_KEY)).not.toBe('ghp_test')
  })

  it('removes the token key when given an empty string', async () => {
    localStorage.setItem(TOKEN_KEY, 'old_token')
    localStorage.setItem(TOKEN_PERSISTENT_KEY, 'v1:old:token')
    sessionStorage.setItem(TOKEN_SESSION_KEY, 'old_token')
    await saveToken('')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(TOKEN_PERSISTENT_KEY)).toBeNull()
    expect(sessionStorage.getItem(TOKEN_SESSION_KEY)).toBeNull()
  })

  it('does not throw when localStorage throws', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    await expect(saveToken('token')).resolves.toBeUndefined()
    expect(sessionStorage.getItem(TOKEN_SESSION_KEY)).toBe('token')
  })
})

/* ── loadTheme ── */
describe('loadTheme', () => {
  it('returns "slate" when nothing is stored (default)', () => {
    expect(loadTheme()).toBe('slate')
  })

  it.each(['warm', 'slate', 'ocean', 'ember', 'zinc'] as const)(
    'returns "%s" when stored',
    (theme) => {
      localStorage.setItem(THEME_KEY, theme)
      expect(loadTheme()).toBe(theme)
    },
  )

  it('returns "slate" for an unrecognised value', () => {
    localStorage.setItem(THEME_KEY, 'totally-unknown')
    expect(loadTheme()).toBe('slate')
  })

  it('returns "slate" when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('security error')
    })
    expect(loadTheme()).toBe('slate')
  })
})

/* ── saveTheme ── */
describe('saveTheme', () => {
  it('writes the theme to localStorage', () => {
    saveTheme('ocean')
    expect(localStorage.getItem(THEME_KEY)).toBe('ocean')
  })

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveTheme('slate')).not.toThrow()
  })
})

/* ── loadMode ── */
describe('loadMode', () => {
  it('returns "dark" when nothing is stored (default)', () => {
    expect(loadMode()).toBe('dark')
  })

  it('returns "light" when stored', () => {
    localStorage.setItem(MODE_KEY, 'light')
    expect(loadMode()).toBe('light')
  })

  it('returns "dark" when stored', () => {
    localStorage.setItem(MODE_KEY, 'dark')
    expect(loadMode()).toBe('dark')
  })

  it('returns "dark" for unrecognised mode value', () => {
    localStorage.setItem(MODE_KEY, 'neon')
    expect(loadMode()).toBe('dark')
  })

  it('returns "dark" when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('security error')
    })
    expect(loadMode()).toBe('dark')
  })
})

/* ── saveMode ── */
describe('saveMode', () => {
  it('writes the mode to localStorage', () => {
    saveMode('light')
    expect(localStorage.getItem(MODE_KEY)).toBe('light')
  })

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveMode('dark')).not.toThrow()
  })
})

/* ── loadCopilotTarget ── */
describe('loadCopilotTarget', () => {
  it('returns empty string when nothing is stored', () => {
    expect(loadCopilotTarget()).toBe('')
  })

  it('returns the stored copilot target', () => {
    localStorage.setItem(COPILOT_TARGET_KEY, 'personal:test-user')
    expect(loadCopilotTarget()).toBe('personal:test-user')
  })

  it('returns empty string when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('security error')
    })
    expect(loadCopilotTarget()).toBe('')
  })
})

/* ── saveCopilotTarget ── */
describe('saveCopilotTarget', () => {
  it('writes the selected copilot target to localStorage', () => {
    saveCopilotTarget('org:thinkdj')
    expect(localStorage.getItem(COPILOT_TARGET_KEY)).toBe('org:thinkdj')
  })

  it('removes the key when given an empty string', () => {
    localStorage.setItem(COPILOT_TARGET_KEY, 'org:thinkdj')
    saveCopilotTarget('')
    expect(localStorage.getItem(COPILOT_TARGET_KEY)).toBeNull()
  })

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveCopilotTarget('org:thinkdj')).not.toThrow()
  })
})

/* ── Round-trip integration ── */
describe('storage round-trips', () => {
  it('can save and reload a token', async () => {
    await saveToken('ghp_roundtrip')
    sessionStorage.removeItem(TOKEN_SESSION_KEY)
    await expect(loadToken()).resolves.toBe('ghp_roundtrip')
    expect(localStorage.getItem(TOKEN_PERSISTENT_KEY)).toMatch(/^v1:/)
    expect(localStorage.getItem(TOKEN_KEY)).toMatch(/^(sha256:[0-9a-f]{64}|fnv1a32:[0-9a-f]{8})$/)
  })

  it('can save and reload a theme', () => {
    saveTheme('ember')
    expect(loadTheme()).toBe('ember')
  })

  it('can save and reload mode', () => {
    saveMode('light')
    expect(loadMode()).toBe('light')
  })

  it('can save and reload repo state', () => {
    const state = { repos: ['org/repo-a', 'org/repo-b'], selectedRepos: ['org/repo-a'] }
    saveRepoState(state)
    expect(loadRepoState([])).toEqual(state)
  })

  it('can save and reload copilot target', () => {
    saveCopilotTarget('personal:test-user')
    expect(loadCopilotTarget()).toBe('personal:test-user')
  })
})
