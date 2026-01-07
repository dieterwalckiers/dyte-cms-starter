import type { AuthStatus } from '../types/index.js'
import {
  getStoredCredentials,
  saveCredentials,
  getRailwayCliToken,
  getGitHubCliToken,
} from './config.js'

// Credential resolution order:
// 1. Environment variable
// 2. Existing CLI auth (railway, gh)
// 3. Stored credentials (~/.config/dyte-cms-starter/)
// 4. Interactive prompt (handled by UI)

export function getClaudeApiKey(): string | undefined {
  // 1. Environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY
  }

  // 2. Stored credentials
  const stored = getStoredCredentials()
  return stored.claudeApiKey
}

export function getRailwayToken(): string | undefined {
  // 1. Environment variable
  if (process.env.RAILWAY_TOKEN) {
    return process.env.RAILWAY_TOKEN
  }

  // 2. Stored credentials (takes precedence over CLI auth)
  const stored = getStoredCredentials()
  if (stored.railwayToken) {
    return stored.railwayToken
  }

  // 3. Railway CLI auth (fallback)
  const cliToken = getRailwayCliToken()
  return cliToken
}

export function getGitHubToken(): string | undefined {
  // 1. Environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN
  }

  // 2. GitHub CLI auth
  const cliToken = getGitHubCliToken()
  if (cliToken) {
    return cliToken
  }

  // 3. Stored credentials
  const stored = getStoredCredentials()
  return stored.githubToken
}

export async function checkAuthStatus(): Promise<AuthStatus> {
  const status: AuthStatus = {
    railway: { authenticated: false },
    github: { authenticated: false },
    claude: { authenticated: false },
  }

  // Check Claude
  const claudeKey = getClaudeApiKey()
  if (claudeKey) {
    status.claude.authenticated = true
  }

  // Check Railway
  const railwayToken = getRailwayToken()
  if (railwayToken) {
    try {
      const user = await verifyRailwayToken(railwayToken)
      status.railway = { authenticated: true, user }
    } catch {
      // Token invalid
    }
  }

  // Check GitHub
  const githubToken = getGitHubToken()
  if (githubToken) {
    try {
      const user = await verifyGitHubToken(githubToken)
      status.github = { authenticated: true, user }
    } catch {
      // Token invalid
    }
  }

  return status
}

async function verifyRailwayToken(token: string): Promise<string> {
  const response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `query { me { email } }`,
    }),
  })

  if (!response.ok) {
    throw new Error('Invalid Railway token')
  }

  const data = (await response.json()) as {
    data?: { me?: { email?: string } }
  }
  return data.data?.me?.email ?? 'unknown'
}

async function verifyGitHubToken(token: string): Promise<string> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    throw new Error('Invalid GitHub token')
  }

  const data = (await response.json()) as { login?: string }
  return data.login ?? 'unknown'
}

export function saveClaudeApiKey(key: string): void {
  saveCredentials({ claudeApiKey: key })
}

export function saveRailwayToken(token: string): void {
  saveCredentials({ railwayToken: token })
}

export function saveGitHubToken(token: string): void {
  saveCredentials({ githubToken: token })
}
