import type { RepoState } from './types'

const REPO_STORAGE_KEY = 'gh.devcp.dashboard.repositories'
const TOKEN_STORAGE_KEY = 'gh.devcp.dashboard.token'
const THEME_STORAGE_KEY = 'gh.devcp.dashboard.theme'
const MODE_STORAGE_KEY = 'gh.devcp.dashboard.mode'

/** Visual palette theme (accent colours, surface tones). */
export type Theme = 'warm' | 'slate' | 'ocean' | 'ember'

/** Brightness mode — applied on top of the active theme. */
export type Mode = 'dark' | 'light'

export const loadRepoState = (defaultRepos: string[]): RepoState => {
  try {
    const raw = localStorage.getItem(REPO_STORAGE_KEY)

    if (!raw) {
      return { repos: defaultRepos, selectedRepos: defaultRepos }
    }

    const parsed = JSON.parse(raw) as RepoState
    if (
      Array.isArray(parsed.repos) &&
      Array.isArray(parsed.selectedRepos) &&
      parsed.repos.length > 0
    ) {
      return {
        repos: parsed.repos,
        selectedRepos: parsed.selectedRepos.filter((repo) => parsed.repos.includes(repo)),
      }
    }
  } catch {
    return { repos: defaultRepos, selectedRepos: defaultRepos }
  }

  return { repos: defaultRepos, selectedRepos: defaultRepos }
}

export const saveRepoState = (state: RepoState) => {
  try {
    localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // no-op: localStorage can be unavailable in restricted browser contexts
  }
}

export const loadToken = (): string => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export const saveToken = (token: string) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    // no-op
  }
}

export const loadTheme = (): Theme => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'warm' || raw === 'slate' || raw === 'ocean' || raw === 'ember') return raw
    // Migrate legacy values
    if (raw === 'notion') return 'slate'
    if (raw === 'dark' || raw === 'light') return 'slate'
    if (raw === 'github') return 'slate'
  } catch {
    // fall through
  }
  return 'slate'
}

export const saveTheme = (theme: Theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // no-op
  }
}

export const loadMode = (): Mode => {
  try {
    const themeRaw = localStorage.getItem(THEME_STORAGE_KEY)
    // Migrate legacy combined theme values
    if (themeRaw === 'light' || themeRaw === 'github') return 'light'

    const raw = localStorage.getItem(MODE_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // fall through
  }
  return 'dark'
}

export const saveMode = (mode: Mode) => {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch {
    // no-op
  }
}
