import { Octokit } from '@octokit/rest'
import { execSync } from 'child_process'
import sealedbox from 'tweetnacl-sealedbox-js'
import naclUtil from 'tweetnacl-util'
import type { GitHubRepo } from '../types/index.js'

export async function createGitHubRepo(
  token: string,
  repoName: string,
  isPrivate: boolean = true
): Promise<GitHubRepo> {
  const octokit = new Octokit({ auth: token })

  // Get authenticated user
  const { data: user } = await octokit.users.getAuthenticated()

  // Create repository
  const { data: repo } = await octokit.repos.createForAuthenticatedUser({
    name: repoName,
    private: isPrivate,
    auto_init: false, // We'll push our own code
    description: `CMS project created with dyte-cms-starter`,
  })

  return {
    owner: user.login,
    repo: repo.name,
    url: repo.html_url,
    cloneUrl: repo.clone_url,
  }
}

export async function setGitHubSecretsViaCli(
  owner: string,
  repo: string,
  secrets: Record<string, string>
): Promise<void> {
  for (const [name, value] of Object.entries(secrets)) {
    try {
      // Use gh CLI to set secrets
      execSync(`gh secret set ${name} --repo ${owner}/${repo}`, {
        input: value,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      throw new Error(`Failed to set secret ${name}: ${error}`)
    }
  }
}

/**
 * Encrypts a secret value for use with the GitHub API.
 * Uses libsodium sealed box encryption.
 */
function encryptSecret(publicKey: string, secretValue: string): string {
  // Decode the public key from base64
  const keyBytes = naclUtil.decodeBase64(publicKey)

  // Encode the secret value as UTF-8
  const messageBytes = naclUtil.decodeUTF8(secretValue)

  // Encrypt using sealed box
  const encryptedBytes = sealedbox.seal(messageBytes, keyBytes)

  // Return base64-encoded encrypted value
  return naclUtil.encodeBase64(encryptedBytes)
}

/**
 * Sets GitHub repository secrets using the GitHub API.
 * This is a fallback when gh CLI is not available.
 */
export async function setGitHubSecretsViaApi(
  token: string,
  owner: string,
  repo: string,
  secrets: Record<string, string>
): Promise<void> {
  const octokit = new Octokit({ auth: token })

  // Get the repository's public key for encrypting secrets
  const { data: publicKeyData } = await octokit.actions.getRepoPublicKey({
    owner,
    repo,
  })

  for (const [name, value] of Object.entries(secrets)) {
    // Encrypt the secret value
    const encryptedValue = encryptSecret(publicKeyData.key, value)

    // Create or update the secret
    await octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: name,
      encrypted_value: encryptedValue,
      key_id: publicKeyData.key_id,
    })
  }
}

export async function initializeAndPushRepo(
  targetDir: string,
  repoUrl: string,
  token: string,
  options: { excludeWorkflow?: boolean } = {}
): Promise<void> {
  try {
    // Initialize git repo
    execSync('git init', { cwd: targetDir, stdio: 'pipe' })

    // Add all files (excluding workflow if specified to prevent premature workflow runs)
    if (options.excludeWorkflow) {
      execSync('git add . \':!.github/workflows/deploy.yml\'', { cwd: targetDir, stdio: 'pipe' })
    } else {
      execSync('git add .', { cwd: targetDir, stdio: 'pipe' })
    }

    // Check if there are any files to commit
    const statusOutput = execSync('git status --porcelain', {
      cwd: targetDir,
      stdio: 'pipe'
    }).toString()

    if (!statusOutput.trim()) {
      throw new Error('No files to commit. The generated project directory appears to be empty or all files are gitignored.')
    }

    // Create initial commit
    execSync('git commit -m "Initial commit from dyte-cms-starter"', {
      cwd: targetDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dyte-cms-starter',
        GIT_AUTHOR_EMAIL: 'noreply@dyte-cms-starter',
        GIT_COMMITTER_NAME: 'dyte-cms-starter',
        GIT_COMMITTER_EMAIL: 'noreply@dyte-cms-starter',
      },
    })

    // Add remote with token authentication
    const authUrl = repoUrl.replace('https://', `https://x-access-token:${token}@`)
    execSync(`git remote add origin ${authUrl}`, { cwd: targetDir, stdio: 'pipe' })

    // Push to main branch
    execSync('git branch -M main', { cwd: targetDir, stdio: 'pipe' })
    execSync('git push -u origin main', { cwd: targetDir, stdio: 'pipe' })
  } catch (error) {
    if (error instanceof Error) {
      // If it's a regular Error, just rethrow it
      if (!error.message.includes('Command failed')) {
        throw error
      }

      // If it's an execSync error, try to get better error info
      const execError = error as Error & { stderr?: Buffer; stdout?: Buffer; status?: number }
      const stderr = execError.stderr?.toString() || ''
      const stdout = execError.stdout?.toString() || ''

      throw new Error(
        `Git operation failed: ${error.message}\n` +
        (stderr ? `stderr: ${stderr}\n` : '') +
        (stdout ? `stdout: ${stdout}` : '')
      )
    }
    throw error
  }
}

export async function deleteGitHubRepo(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const octokit = new Octokit({ auth: token })

  await octokit.repos.delete({
    owner,
    repo,
  })
}

export async function getGitHubUsername(token: string): Promise<string> {
  const octokit = new Octokit({ auth: token })
  const { data: user } = await octokit.users.getAuthenticated()
  return user.login
}

export async function checkGhCliAvailable(): Promise<boolean> {
  try {
    execSync('gh --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Commits and pushes the workflow file after initial setup.
 * This is done separately to prevent the workflow from running on the initial commit.
 */
export async function commitAndPushWorkflow(
  targetDir: string
): Promise<void> {
  try {
    // Add the workflow file
    execSync('git add .github/workflows/deploy.yml', { cwd: targetDir, stdio: 'pipe' })

    // Check if there are changes to commit
    const statusOutput = execSync('git status --porcelain', {
      cwd: targetDir,
      stdio: 'pipe'
    }).toString()

    if (!statusOutput.trim()) {
      // Workflow file was already committed (shouldn't happen, but handle gracefully)
      return
    }

    // Commit the workflow file
    execSync('git commit -m "Add GitHub Actions workflow for auto-deploy"', {
      cwd: targetDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'dyte-cms-starter',
        GIT_AUTHOR_EMAIL: 'noreply@dyte-cms-starter',
        GIT_COMMITTER_NAME: 'dyte-cms-starter',
        GIT_COMMITTER_EMAIL: 'noreply@dyte-cms-starter',
      },
    })

    // Push to remote
    execSync('git push origin main', { cwd: targetDir, stdio: 'pipe' })
  } catch (error) {
    throw new Error(
      `Failed to commit and push workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Polls for the GitHub Actions workflow run to complete.
 * Looks for the most recent workflow run after the specified timestamp.
 */
export async function waitForWorkflowCompletion(
  token: string,
  owner: string,
  repo: string,
  triggerTimestamp: Date,
  options: {
    maxWaitTime?: number // Max time to wait in ms (default: 10 minutes)
    pollInterval?: number // Poll interval in ms (default: 10 seconds)
    onProgress?: (status: string, conclusion?: string) => void
  } = {}
): Promise<{ success: boolean; conclusion: string; url: string }> {
  const octokit = new Octokit({ auth: token })
  const maxWaitTime = options.maxWaitTime ?? 10 * 60 * 1000 // 10 minutes
  const pollInterval = options.pollInterval ?? 10 * 1000 // 10 seconds
  const startTime = Date.now()

  // Wait a few seconds for GitHub to register the workflow run
  await new Promise(resolve => setTimeout(resolve, 5000))

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // List workflow runs for the repository
      const { data: runs } = await octokit.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: 10,
        created: `>=${triggerTimestamp.toISOString()}`,
      })

      // Find the most recent workflow run triggered after our timestamp
      const relevantRun = runs.workflow_runs.find(
        run => new Date(run.created_at) >= triggerTimestamp
      )

      if (relevantRun) {
        const status = relevantRun.status ?? 'unknown'
        const conclusion = relevantRun.conclusion ?? undefined

        options.onProgress?.(status, conclusion)

        // Check if workflow has completed
        if (relevantRun.status === 'completed') {
          return {
            success: relevantRun.conclusion === 'success',
            conclusion: relevantRun.conclusion ?? 'unknown',
            url: relevantRun.html_url,
          }
        }
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      throw new Error(
        `Failed to check workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  throw new Error(`Workflow did not complete within ${maxWaitTime / 1000 / 60} minutes`)
}
