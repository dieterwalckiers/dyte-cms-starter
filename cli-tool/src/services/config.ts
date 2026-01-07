import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import type { StoredCredentials, AppConfig } from '../types/index.js'

const CONFIG_DIR = join(homedir(), '.config', 'dyte-cms-starter')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function getStoredCredentials(): StoredCredentials {
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      const content = readFileSync(CREDENTIALS_FILE, 'utf-8')
      return JSON.parse(content) as StoredCredentials
    }
  } catch {
    // Ignore errors, return empty object
  }
  return {}
}

export function saveCredentials(credentials: Partial<StoredCredentials>): void {
  ensureConfigDir()
  const existing = getStoredCredentials()
  const merged = { ...existing, ...credentials }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(merged, null, 2), {
    mode: 0o600, // Owner read/write only
  })
}

export function getAppConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      const content = readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(content) as AppConfig
    }
  } catch {
    // Ignore errors, return empty object
  }
  return {}
}

export function saveAppConfig(config: Partial<AppConfig>): void {
  ensureConfigDir()
  const existing = getAppConfig()
  const merged = { ...existing, ...config }
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2))
}

// Check for Railway CLI auth token
export function getRailwayCliToken(): string | undefined {
  const railwayDir = join(homedir(), '.railway')
  const tokenFile = join(railwayDir, 'config.json')

  try {
    if (existsSync(tokenFile)) {
      const content = readFileSync(tokenFile, 'utf-8')
      const config = JSON.parse(content) as { user?: { token?: string } }
      return config.user?.token
    }
  } catch {
    // Ignore errors
  }
  return undefined
}

// Check for GitHub CLI auth token
export function getGitHubCliToken(): string | undefined {
  const ghConfigDir = join(homedir(), '.config', 'gh')
  const hostsFile = join(ghConfigDir, 'hosts.yml')

  try {
    if (existsSync(hostsFile)) {
      const content = readFileSync(hostsFile, 'utf-8')
      // Simple YAML parsing for oauth_token
      const match = content.match(/oauth_token:\s*(.+)/)
      if (match) {
        return match[1].trim()
      }
    }
  } catch {
    // Ignore errors
  }
  return undefined
}

export function getConfigDir(): string {
  return CONFIG_DIR
}
