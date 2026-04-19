import type { RepoState } from './types'

const REPO_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.repositories'
const TOKEN_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.token'
const THEME_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.theme'
const MODE_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.mode'
const COPILOT_TARGET_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.copilotTarget'

// One-time migration: move data from old gh.devcp keys to the new prpulse.gh.devcp keys.
;(function migrateStorageKeys() {
  const migrations: [string, string][] = [
    ['gh.devcp.dashboard.repositories', REPO_STORAGE_KEY],
    ['gh.devcp.dashboard.token', TOKEN_STORAGE_KEY],
    ['gh.devcp.dashboard.theme', THEME_STORAGE_KEY],
    ['gh.devcp.dashboard.mode', MODE_STORAGE_KEY],
    ['gh.devcp.dashboard.copilotTarget', COPILOT_TARGET_STORAGE_KEY],
  ]
  try {
    for (const [oldKey, newKey] of migrations) {
      const oldValue = localStorage.getItem(oldKey)
      if (oldValue !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue)
        localStorage.removeItem(oldKey)
      }
    }
  } catch {
    // no-op: localStorage can be unavailable in restricted browser contexts
  }
})()

/** Visual palette theme (accent colours, surface tones). */
export type Theme = 'warm' | 'slate' | 'ocean' | 'ember' | 'zinc'

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
    if (raw === 'warm' || raw === 'slate' || raw === 'ocean' || raw === 'ember' || raw === 'zinc') return raw
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

export const loadCopilotTarget = (): string => {
  try {
    return localStorage.getItem(COPILOT_TARGET_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export const saveCopilotTarget = (target: string) => {
  try {
    if (target) {
      localStorage.setItem(COPILOT_TARGET_STORAGE_KEY, target)
    } else {
      localStorage.removeItem(COPILOT_TARGET_STORAGE_KEY)
    }
  } catch {
    // no-op
  }
}
