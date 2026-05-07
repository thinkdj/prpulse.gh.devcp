import type { RepoState } from './types'

const REPO_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.repositories'
const TOKEN_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.token'
const TOKEN_SESSION_KEY = 'prpulse.gh.devcp.dashboard.token.session'
const TOKEN_PERSISTENT_KEY = 'prpulse.gh.devcp.dashboard.token.encrypted'
const THEME_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.theme'
const MODE_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.mode'
const COPILOT_TARGET_STORAGE_KEY = 'prpulse.gh.devcp.dashboard.copilotTarget'
const TOKEN_ENCRYPTION_CONTEXT = 'prpulse.gh.devcp.dashboard.token.v1'

const fallbackHashToken = (token: string): string => {
  let h = 2166136261 >>> 0
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `fnv1a32:${(h >>> 0).toString(16).padStart(8, '0')}`
}

const hashToken = async (token: string): Promise<string> => {
  try {
    const encoded = new TextEncoder().encode(token)
    const digest = await crypto.subtle.digest('SHA-256', encoded)
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `sha256:${hex}`
  } catch {
    return fallbackHashToken(token)
  }
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const deriveTokenKey = async (): Promise<CryptoKey> => {
  if (!crypto?.subtle) {
    throw new Error('Web Crypto API unavailable')
  }

  const keyMaterialSource = `${TOKEN_ENCRYPTION_CONTEXT}|${window.location.origin}|${navigator.userAgent}`
  const keyMaterialBytes = new TextEncoder().encode(keyMaterialSource)
  const keyHash = await crypto.subtle.digest('SHA-256', keyMaterialBytes)
  return crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

const encryptToken = async (token: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const key = await deriveTokenKey()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  )

  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`
}

const decryptToken = async (payload: string): Promise<string> => {
  const [version, ivBase64, dataBase64] = payload.split(':')
  if (version !== 'v1' || !ivBase64 || !dataBase64) {
    throw new Error('Unsupported encrypted token payload')
  }

  const key = await deriveTokenKey()
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivBase64) as Uint8Array<ArrayBuffer> },
    key,
    base64ToBytes(dataBase64) as Uint8Array<ArrayBuffer>,
  )

  return new TextDecoder().decode(plaintext)
}

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

export const loadToken = async (): Promise<string> => {
  try {
    const sessionToken = sessionStorage.getItem(TOKEN_SESSION_KEY)
    if (sessionToken) return sessionToken

    const encryptedToken = localStorage.getItem(TOKEN_PERSISTENT_KEY) ?? ''
    if (encryptedToken) {
      const persistentToken = await decryptToken(encryptedToken)
      // Keep session storage in sync so existing code paths continue to work.
      sessionStorage.setItem(TOKEN_SESSION_KEY, persistentToken)
      return persistentToken
    }

    return ''
  } catch {
    localStorage.removeItem(TOKEN_PERSISTENT_KEY)
    return ''
  }
}

export const saveToken = async (token: string): Promise<void> => {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_SESSION_KEY, token)
      localStorage.setItem(TOKEN_PERSISTENT_KEY, await encryptToken(token))
      localStorage.setItem(TOKEN_STORAGE_KEY, await hashToken(token))
    } else {
      sessionStorage.removeItem(TOKEN_SESSION_KEY)
      localStorage.removeItem(TOKEN_PERSISTENT_KEY)
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
