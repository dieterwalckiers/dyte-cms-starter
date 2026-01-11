import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text } from 'ink'
import { AuthCheck } from './components/AuthCheck.js'
import { ModeSelection } from './components/ModeSelection.js'
import { DeleteProject } from './components/DeleteProject.js'
import { ProjectComplete } from './components/ProjectComplete.js'
import { ProjectError } from './components/ProjectError.js'
import { Questionnaire } from './components/Questionnaire.js'
import { CollectionPreview } from './components/CollectionPreview.js'
import { ProvisioningProgress } from './components/ProvisioningProgress.js'
import { Spinner } from './components/Spinner.js'
import { GitHubRailwaySetup } from './components/GitHubRailwaySetup.js'
import { generateCollections } from './services/llm.js'
import { scaffoldProject } from './services/scaffolder.js'
import {
  createGitHubRepo,
  setGitHubSecretsViaCli,
  setGitHubSecretsViaApi,
  initializeAndPushRepo,
  commitAndPushWorkflow,
  checkGhCliAvailable,
  deleteGitHubRepo,
  waitForWorkflowCompletion,
} from './services/github.js'
import {
  waitForPayloadReady,
  authenticatePayload,
  createPage,
  generateSimpleLexicalContent
} from './services/payload.js'
// getGitHubUsername can be used if we need the username for display
import {
  createRailwayProject,
  provisionPostgres,
  createService,
  connectServiceToGitHub,
  setServiceRootDirectory,
  setServiceVariables,
  getServiceDomain,
  deleteRailwayProject,
  generatePayloadSecret,
} from './services/railway.js'
import type {
  CLIStep,
  ProjectConfig,
  GeneratedCollection,
  ProvisioningStep,
  TemplateContext,
} from './types/index.js'
import { join } from 'path'
import { existsSync, cpSync, copyFileSync } from 'fs'
import { spawn } from 'child_process'
import { homedir } from 'os'

const VERSION = '0.1.0'
const MAX_LLM_RETRIES = 3

// Helper functions for test values mode
function getCachedFilesPath() {
  return join(homedir(), '.config', 'dyte-cms-starter', 'testvalues')
}

function validateCachedFiles(): { valid: boolean; missingFiles: string[] } {
  const basePath = getCachedFilesPath()
  const requiredPaths = [
    join(basePath, 'payload', 'node_modules'),
    join(basePath, 'payload', 'package-lock.json'),
    join(basePath, 'web', 'node_modules'),
    join(basePath, 'web', 'package-lock.json'),
  ]

  const missingFiles = requiredPaths.filter(path => !existsSync(path))
  return {
    valid: missingFiles.length === 0,
    missingFiles,
  }
}

function copyCachedFiles(targetDir: string) {
  const basePath = getCachedFilesPath()

  // Copy payload files
  const payloadNodeModulesSrc = join(basePath, 'payload', 'node_modules')
  const payloadNodeModulesDest = join(targetDir, 'payload', 'node_modules')
  const payloadLockSrc = join(basePath, 'payload', 'package-lock.json')
  const payloadLockDest = join(targetDir, 'payload', 'package-lock.json')

  cpSync(payloadNodeModulesSrc, payloadNodeModulesDest, { recursive: true })
  copyFileSync(payloadLockSrc, payloadLockDest)

  // Copy web files
  const webNodeModulesSrc = join(basePath, 'web', 'node_modules')
  const webNodeModulesDest = join(targetDir, 'web', 'node_modules')
  const webLockSrc = join(basePath, 'web', 'package-lock.json')
  const webLockDest = join(targetDir, 'web', 'package-lock.json')

  cpSync(webNodeModulesSrc, webNodeModulesDest, { recursive: true })
  copyFileSync(webLockSrc, webLockDest)
}

interface Credentials {
  claudeApiKey: string
  railwayToken: string
  githubToken: string
}

interface AppProps {
  withTestValues?: boolean
  skipToHomePageStep?: boolean
  debugServiceUrl?: string
}

export function App({ withTestValues = false, skipToHomePageStep = false, debugServiceUrl }: AppProps): React.ReactElement {

  const [step, setStep] = useState<CLIStep>('auth-check')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null)
  const [collections, setCollections] = useState<GeneratedCollection[]>([])
  const [llmRetries, setLlmRetries] = useState(MAX_LLM_RETRIES)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [provisioningSteps, setProvisioningSteps] = useState<ProvisioningStep[]>([])
  const [finalResult, setFinalResult] = useState<{
    cmsUrl: string
    repoUrl: string
    websiteUrl: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Rollback state
  const [createdResources, setCreatedResources] = useState<{
    githubRepo?: { owner: string; repo: string }
    railwayProjectId?: string
  }>({})

  // Debug mode: Skip to home page creation step
  useEffect(() => {
    if (skipToHomePageStep && debugServiceUrl) {
      // Use test values for config
      const config: ProjectConfig = {
        projectName: 'testdytecmsstarter',
        projectSlug: 'testdytecmsstarter',
        adminEmail: 'd.walckiers@protonmail.com',
        adminPassword: 'respons1ve',
        collectionDescription: '',
        ftpHost: 'ftp.tkartel.gent',
        ftpUsername: 'tkartelgent@tkartelgent',
        ftpPassword: '3n52JC3j4557e2Uz91v8',
        ftpPath: '/www/testdytecmsstarter',
        websiteUrl: 'https://tkartel.gent/testdytecmsstarter',
        websitePath: '/testdytecmsstarter',
      }
      setProjectConfig(config)

      // Set up provisioning steps for just the home page creation
      const steps: ProvisioningStep[] = [
        { label: 'Creating initial Home page', status: 'pending' },
        { label: 'Enabling webhook and triggering deploy', status: 'pending' },
      ]
      setProvisioningSteps(steps)

      // Go directly to provisioning
      setStep('provisioning')

      // Run the home page creation steps
      const runDebugProvisioning = async () => {
        const updateStep = (index: number, status: ProvisioningStep['status'], error?: string, details?: string[]) => {
          setProvisioningSteps(prev => {
            const updated = [...prev]
            if (updated[index]) {
              updated[index] = { ...updated[index], status, error, details }
            }
            return updated
          })
        }

        try {
          // Step 0: Create Home page (Payload is already ready in debug mode)
          updateStep(0, 'in_progress')
          try {
            const token = await authenticatePayload(
              debugServiceUrl,
              config.adminEmail,
              config.adminPassword
            )

            const homeContent = generateSimpleLexicalContent(
              `Welcome to ${config.projectName}! 🚀 This is your brand new CMS-powered website. Start creating amazing content!`
            )

            await createPage(debugServiceUrl, token, {
              title: 'Home',
              slug: 'home',
              showInMenu: true,
              menuOrder: 1,
              body: homeContent
            })

            updateStep(0, 'complete')
          } catch (err) {
            throw new Error(`Failed to create Home page: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }

          // Step 1: Note about static site build
          updateStep(1, 'in_progress')
          updateStep(1, 'complete')

          setFinalResult({
            cmsUrl: `${debugServiceUrl}/admin`,
            repoUrl: 'https://github.com/user/repo',
            websiteUrl: config.websiteUrl,
          })
          setStep('complete')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          setError(message)
          setStep('error')
        }
      }

      runDebugProvisioning()
    }
  }, [skipToHomePageStep, debugServiceUrl])

  const handleAuthComplete = useCallback((creds: Credentials) => {
    setCredentials(creds)
    setStep('mode-selection')
  }, [])

  const handleModeStartNew = useCallback(() => {
    setStep('questionnaire')
  }, [])

  const handleModeDelete = useCallback(() => {
    setStep('delete-project')
  }, [])

  const handleDeleteComplete = useCallback(() => {
    setStep('mode-selection')
  }, [])

  const handleDeleteCancel = useCallback(() => {
    setStep('mode-selection')
  }, [])

  const handleReturnToMenu = useCallback(() => {
    // Reset state for fresh start
    setProjectConfig(null)
    setCollections([])
    setFinalResult(null)
    setError(null)
    setCreatedResources({})
    setLlmRetries(MAX_LLM_RETRIES)
    setLlmError(null)
    setStep('mode-selection')
  }, [])

  const handleQuestionnaireComplete = useCallback(
    async (config: ProjectConfig) => {
      setProjectConfig(config)

      if (config.collectionDescription.trim()) {
        setStep('collection-generation')
        await generateCollectionsFromDescription(config.collectionDescription)
      } else {
        // Skip LLM generation, go straight to provisioning
        setStep('provisioning')
      }
    },
    [credentials]
  )

  const generateCollectionsFromDescription = async (
    description: string,
    feedback?: string,
    previousCollections?: GeneratedCollection[]
  ) => {
    if (!credentials) return

    setLlmError(null)

    try {
      const generated = await generateCollections({
        description,
        apiKey: credentials.claudeApiKey,
        feedback,
        previousCollections,
      })
      setCollections(generated)
      setStep('collection-preview')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setLlmError(message)

      if (llmRetries > 1) {
        setLlmRetries((r) => r - 1)
      } else {
        // Out of retries, skip collections
        setCollections([])
        setStep('provisioning')
      }
    }
  }

  const handleCollectionAccept = useCallback(() => {
    setStep('provisioning')
  }, [])

  const handleCollectionReject = useCallback(
    async (feedback: string) => {
      if (!projectConfig) return

      // User feedback doesn't count against retries - only errors do
      setStep('collection-generation')
      await generateCollectionsFromDescription(
        projectConfig.collectionDescription,
        feedback || undefined,
        collections.length > 0 ? collections : undefined
      )
    },
    [projectConfig, credentials, collections]
  )

  // Run provisioning when step changes to 'provisioning'
  useEffect(() => {
    if (step === 'provisioning' && projectConfig && credentials) {
      runProvisioning()
    }
  }, [step])

  const runProvisioning = async () => {
    if (!projectConfig || !credentials) return

    const steps: ProvisioningStep[] = [
      { label: 'Scaffolding project files', status: 'pending' },
      { label: 'Installing dependencies', status: 'pending' },
      { label: 'Creating Railway project', status: 'pending' },
      { label: 'Provisioning PostgreSQL database', status: 'pending' },
      { label: 'Generating database migrations', status: 'pending' },
      { label: 'Creating GitHub repository', status: 'pending' },
      { label: 'Pushing code to GitHub', status: 'pending' },
      { label: 'Deploying Payload CMS', status: 'pending' },
      { label: 'Configuring GitHub Secrets', status: 'pending' },
      { label: 'Waiting for Payload CMS to be ready (3-5 min - please be patient!)', status: 'pending' },
      { label: 'Creating initial Home page', status: 'pending' },
      { label: 'Enabling webhook and triggering deploy', status: 'pending' },
      { label: 'Waiting for GitHub Actions workflow to complete', status: 'pending' },
    ]

    setProvisioningSteps(steps)

    const targetDir = join(process.cwd(), projectConfig.projectSlug)

    // Check if directory already exists
    if (existsSync(targetDir)) {
      setStep('error')
      setError(
        `Directory "${projectConfig.projectSlug}" already exists in the current directory.\n` +
        `Please remove it first or choose a different project name.`
      )
      return
    }

    try {
      // Step 0: Scaffold project
      updateStep(0, 'in_progress')
      const context: TemplateContext = {
        projectName: projectConfig.projectName,
        projectSlug: projectConfig.projectSlug,
        adminEmail: projectConfig.adminEmail,
        railwayUrl: '', // Will be filled later
        githubRepo: '', // Will be filled later
        collections,
        payloadSecret: generatePayloadSecret(),
        websitePath: projectConfig.websitePath,
      }
      await scaffoldProject(targetDir, context)
      updateStep(0, 'complete')

      // Step 1: Install dependencies to generate lock files
      updateStep(1, 'in_progress')

      if (withTestValues) {
        // Validate cached files exist
        const validation = validateCachedFiles()
        if (!validation.valid) {
          throw new Error(
            `Missing cached files for --withTestValues mode:\n${validation.missingFiles.join('\n')}\n\n` +
            `Expected cache location: ${getCachedFilesPath()}`
          )
        }

        // Copy cached node_modules and package-lock.json files
        copyCachedFiles(targetDir)
      } else {
        const payloadDir = join(targetDir, 'payload')
        const webDir = join(targetDir, 'web')

        // Install payload dependencies (with live output)
        await runNpmInstall(payloadDir, 1, 'payload')

        // Install web dependencies (with live output)
        await runNpmInstall(webDir, 1, 'web')
      }

      updateStep(1, 'complete')

      // Step 2: Create Railway project
      updateStep(2, 'in_progress')
      const { projectId, environmentId } = await createRailwayProject(
        credentials.railwayToken,
        projectConfig.projectSlug
      )
      setCreatedResources((r) => ({
        ...r,
        railwayProjectId: projectId,
      }))
      updateStep(2, 'complete')

      // Step 3: Provision PostgreSQL
      updateStep(3, 'in_progress')
      const databaseUrl = await provisionPostgres(
        credentials.railwayToken,
        projectId,
        environmentId
      )
      updateStep(3, 'complete')

      // Step 4: Generate database migrations
      updateStep(4, 'in_progress')
      const payloadDir = join(targetDir, 'payload')
      await runPayloadMigrationGeneration(payloadDir, databaseUrl, 4)
      updateStep(4, 'complete')

      // Step 5: Create GitHub repo
      updateStep(5, 'in_progress')
      const githubRepo = await createGitHubRepo(
        credentials.githubToken,
        projectConfig.projectSlug
      )
      setCreatedResources((r) => ({
        ...r,
        githubRepo: { owner: githubRepo.owner, repo: githubRepo.repo },
      }))
      updateStep(5, 'complete')

      // Step 6: Push to GitHub (excluding workflow to prevent premature trigger)
      updateStep(6, 'in_progress')
      await initializeAndPushRepo(
        targetDir,
        githubRepo.cloneUrl,
        credentials.githubToken,
        { excludeWorkflow: true }
      )
      updateStep(6, 'complete')

      // Step 7: Deploy Payload CMS service
      updateStep(7, 'in_progress')

      // Create empty service (no GitHub connection yet)
      const serviceId = await createService(
        credentials.railwayToken,
        projectId,
        projectConfig.projectSlug
      )

      // Set root directory BEFORE connecting GitHub (prevents build failure)
      await setServiceRootDirectory(
        credentials.railwayToken,
        environmentId,
        serviceId,
        'payload'
      )

      // Get domain for the service (before setting env vars)
      const serviceUrl = await getServiceDomain(
        credentials.railwayToken,
        environmentId,
        serviceId
      )

      // Set environment variables BEFORE connecting GitHub
      // This ensures the first build has all correct env vars
      // Note: GITHUB_TOKEN is NOT set yet to prevent webhook from firing during initial page creation
      const payloadSecret = generatePayloadSecret()
      await setServiceVariables(
        credentials.railwayToken,
        projectId,
        environmentId,
        serviceId,
        {
          // App environment
          DATABASE_URL: databaseUrl,
          PAYLOAD_SECRET: payloadSecret,
          PAYLOAD_PUBLIC_SERVER_URL: serviceUrl,
          PAYLOAD_ADMIN_EMAIL: projectConfig.adminEmail,
          PAYLOAD_ADMIN_PASSWORD: projectConfig.adminPassword,
          GITHUB_REPO: `${githubRepo.owner}/${githubRepo.repo}`,
          // Railway configuration
          RAILWAY_DOCKERFILE_PATH: 'payload/Dockerfile',
          NIXPACKS_CONFIG_FILE: 'payload/nixpacks.toml',
        }
      )

      // Connect GitHub repo (this will trigger ONE build with all env vars set)
      await connectServiceToGitHub(
        credentials.railwayToken,
        serviceId,
        `${githubRepo.owner}/${githubRepo.repo}`
      )

      // Note: No need to call deployService - Railway auto-deploys when GitHub is connected
      updateStep(7, 'complete')

      // Step 8: GitHub Secrets
      updateStep(8, 'in_progress')
      const secrets = {
        FTP_HOST: projectConfig.ftpHost,
        FTP_USERNAME: projectConfig.ftpUsername,
        FTP_PASSWORD: projectConfig.ftpPassword,
        FTP_SERVER_DIR: projectConfig.ftpPath,
        PAYLOAD_API_URL: `${serviceUrl}/api`,
      }

      const ghCliAvailable = await checkGhCliAvailable()
      if (ghCliAvailable) {
        // Prefer gh CLI if available (faster)
        await setGitHubSecretsViaCli(githubRepo.owner, githubRepo.repo, secrets)
      } else {
        // Fall back to GitHub API
        await setGitHubSecretsViaApi(
          credentials.githubToken,
          githubRepo.owner,
          githubRepo.repo,
          secrets
        )
      }
      updateStep(8, 'complete')

      // Step 9: Wait for Payload CMS to be ready
      updateStep(9, 'in_progress')
      try {
        await waitForPayloadReady(serviceUrl)
        updateStep(9, 'complete')
      } catch (err) {
        throw new Error(`Payload CMS did not become ready: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      // Step 10: Create Home page
      updateStep(10, 'in_progress')
      try {
        // Authenticate
        const token = await authenticatePayload(
          serviceUrl,
          projectConfig.adminEmail,
          projectConfig.adminPassword
        )

        // Create page
        const homeContent = generateSimpleLexicalContent(
          `Welcome to ${projectConfig.projectName}! 🚀 This is your brand new CMS-powered website. Start creating amazing content!`
        )

        await createPage(serviceUrl, token, {
          title: 'Home',
          slug: 'home',
          showInMenu: true,
          menuOrder: 1,
          body: homeContent
        })

        updateStep(10, 'complete')
      } catch (err) {
        throw new Error(`Failed to create Home page: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      // Step 11: Enable webhook and trigger static site build
      updateStep(11, 'in_progress')
      // Now that initial page is created, set GITHUB_TOKEN so future content updates trigger deploys
      await setServiceVariables(
        credentials.railwayToken,
        projectId,
        environmentId,
        serviceId,
        {
          GITHUB_TOKEN: credentials.githubToken,
        }
      )

      // Commit and push the workflow file (excluded from initial commit to prevent premature trigger)
      await commitAndPushWorkflow(targetDir)

      // Manually trigger the first deploy via repository_dispatch
      // (webhook didn't fire during page creation because GITHUB_TOKEN wasn't set yet)
      const triggerTimestamp = new Date()
      const response = await fetch(`https://api.github.com/repos/${githubRepo.owner}/${githubRepo.repo}/dispatches`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${credentials.githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'content_update',
          client_payload: {
            collection: 'pages',
            timestamp: triggerTimestamp.toISOString(),
          },
        }),
      })

      if (response.status !== 204) {
        const errorText = await response.text()
        throw new Error(`Failed to trigger deploy: ${response.status} ${errorText}`)
      }
      updateStep(11, 'complete')

      // Step 12: Wait for GitHub Actions workflow to complete
      updateStep(12, 'in_progress')
      try {
        const workflowResult = await waitForWorkflowCompletion(
          credentials.githubToken,
          githubRepo.owner,
          githubRepo.repo,
          triggerTimestamp,
          {
            maxWaitTime: 10 * 60 * 1000, // 10 minutes
            pollInterval: 10 * 1000, // 10 seconds
            onProgress: (status, conclusion) => {
              const details = [`Status: ${status}`]
              if (conclusion) {
                details.push(`Conclusion: ${conclusion}`)
              }
              updateStep(12, 'in_progress', undefined, details)
            },
          }
        )

        if (workflowResult.success) {
          updateStep(12, 'complete')
        } else {
          throw new Error(
            `GitHub Actions workflow failed with conclusion: ${workflowResult.conclusion}. ` +
            `View details at: ${workflowResult.url}`
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new Error(`Failed to complete GitHub Actions workflow: ${message}`)
      }

      setFinalResult({
        cmsUrl: `${serviceUrl}/admin`,
        repoUrl: githubRepo.url,
        websiteUrl: projectConfig.websiteUrl,
      })
      setStep('complete')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)

      // Mark current step as error
      const currentIdx = provisioningSteps.findIndex(
        (s) => s.status === 'in_progress'
      )
      if (currentIdx >= 0) {
        updateStep(currentIdx, 'error', message)
      }

      setStep('error')

      // Attempt rollback
      await rollback()
    }
  }

  const updateStep = (
    index: number,
    status: ProvisioningStep['status'],
    errorMsg?: string,
    details?: string[]
  ) => {
    setProvisioningSteps((steps) =>
      steps.map((s, i) =>
        i === index ? { ...s, status, error: errorMsg, details } : s
      )
    )
  }

  const runNpmInstall = (
    cwd: string,
    stepIndex: number,
    label: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const outputLines: string[] = []
      const allOutput: string[] = []
      const maxLines = 5
      const maxErrorLines = 50

      const proc = spawn('npm', ['install'], {
        cwd,
        shell: true,
      })

      const addLine = (line: string) => {
        if (line.trim()) {
          const trimmedLine = line.trim()
          outputLines.push(trimmedLine)
          allOutput.push(trimmedLine)
          // Keep only last 5 lines for display
          if (outputLines.length > maxLines) {
            outputLines.shift()
          }
          // Keep last 50 lines for error reporting
          if (allOutput.length > maxErrorLines) {
            allOutput.shift()
          }
          // Update step with current output
          updateStep(stepIndex, 'in_progress', undefined, [...outputLines])
        }
      }

      proc.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach(addLine)
      })

      proc.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach(addLine)
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          const errorOutput = allOutput.length > 0
            ? `\n\nOutput:\n${allOutput.join('\n')}`
            : ''
          reject(new Error(`npm install failed in ${label} with exit code ${code}${errorOutput}`))
        }
      })

      proc.on('error', (err) => {
        const errorOutput = allOutput.length > 0
          ? `\n\nOutput:\n${allOutput.join('\n')}`
          : ''
        reject(new Error(`Failed to run npm install in ${label}: ${err.message}${errorOutput}`))
      })
    })
  }

  const runPayloadMigrationGeneration = (
    payloadDir: string,
    databaseUrl: string,
    stepIndex: number
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const outputLines: string[] = []
      const allOutput: string[] = []
      const maxLines = 5
      const maxErrorLines = 50

      const proc = spawn('npx', ['payload', 'migrate:create', '--name', 'initial'], {
        cwd: payloadDir,
        shell: true,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      })

      const addLine = (line: string) => {
        if (line.trim()) {
          const trimmedLine = line.trim()
          outputLines.push(trimmedLine)
          allOutput.push(trimmedLine)
          if (outputLines.length > maxLines) {
            outputLines.shift()
          }
          if (allOutput.length > maxErrorLines) {
            allOutput.shift()
          }
          updateStep(stepIndex, 'in_progress', undefined, [...outputLines])
        }
      }

      proc.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach(addLine)
      })

      proc.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach(addLine)
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          const errorOutput = allOutput.length > 0
            ? `\n\nOutput:\n${allOutput.join('\n')}`
            : ''
          reject(new Error(`Migration generation failed with exit code ${code}${errorOutput}`))
        }
      })

      proc.on('error', (err) => {
        const errorOutput = allOutput.length > 0
          ? `\n\nOutput:\n${allOutput.join('\n')}`
          : ''
        reject(new Error(`Failed to generate migrations: ${err.message}${errorOutput}`))
      })
    })
  }

  const rollback = async () => {
    if (!credentials) return

    // Try to clean up created resources
    if (createdResources.githubRepo) {
      try {
        await deleteGitHubRepo(
          credentials.githubToken,
          createdResources.githubRepo.owner,
          createdResources.githubRepo.repo
        )
      } catch {
        // Ignore rollback errors
      }
    }

    if (createdResources.railwayProjectId) {
      try {
        await deleteRailwayProject(
          credentials.railwayToken,
          createdResources.railwayProjectId
        )
      } catch {
        // Ignore rollback errors
      }
    }
  }

  const handleGitHubRailwaySetupComplete = useCallback(() => {
    // GitHub is now connected, restart provisioning
    setStep('provisioning')
  }, [])

  const handleGitHubRailwaySetupCancel = useCallback(() => {
    setError('GitHub-Railway setup was cancelled.')
    setStep('error')
  }, [])

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>{'┌' + '─'.repeat(60) + '┐'}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold>│  dyte-cms-starter v{VERSION}</Text>
        <Text>{' '.repeat(60 - 25 - VERSION.length)}│</Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold>{'└' + '─'.repeat(60) + '┘'}</Text>
      </Box>

      {/* Auth Check */}
      {step === 'auth-check' && <AuthCheck onComplete={handleAuthComplete} />}

      {/* Mode Selection */}
      {step === 'mode-selection' && (
        <ModeSelection
          onStartNew={handleModeStartNew}
          onDelete={handleModeDelete}
        />
      )}

      {/* Delete Project */}
      {step === 'delete-project' && credentials && (
        <DeleteProject
          railwayToken={credentials.railwayToken}
          githubToken={credentials.githubToken}
          onComplete={handleDeleteComplete}
          onCancel={handleDeleteCancel}
        />
      )}

      {/* Questionnaire */}
      {step === 'questionnaire' && (
        <Questionnaire onComplete={handleQuestionnaireComplete} withTestValues={withTestValues} />
      )}

      {/* Collection Generation */}
      {step === 'collection-generation' && (
        <Box flexDirection="column">
          <Spinner label="Generating collections with Claude..." />
          {llmError && (
            <Box marginTop={1}>
              <Text color="red">Error: {llmError}</Text>
              <Text color="gray">
                {' '}
                ({llmRetries} retries remaining)
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Collection Preview */}
      {step === 'collection-preview' && collections.length > 0 && (
        <CollectionPreview
          collections={collections}
          onAccept={handleCollectionAccept}
          onReject={handleCollectionReject}
        />
      )}

      {/* Provisioning */}
      {step === 'provisioning' && (
        <ProvisioningProgress steps={provisioningSteps} />
      )}

      {/* GitHub-Railway Setup */}
      {step === 'github-railway-setup' && (
        <GitHubRailwaySetup
          onComplete={handleGitHubRailwaySetupComplete}
          onCancel={handleGitHubRailwaySetupCancel}
        />
      )}

      {/* Complete */}
      {step === 'complete' && finalResult && (
        <ProjectComplete
          cmsUrl={finalResult.cmsUrl}
          repoUrl={finalResult.repoUrl}
          websiteUrl={finalResult.websiteUrl}
          onReturnToMenu={handleReturnToMenu}
        />
      )}

      {/* Error */}
      {step === 'error' && error && (
        <ProjectError error={error} onReturnToMenu={handleReturnToMenu} />
      )}
    </Box>
  )
}
