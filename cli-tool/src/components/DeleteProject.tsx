import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'
import { Spinner } from './Spinner.js'
import { deleteGitHubRepo, getGitHubUsername } from '../services/github.js'
import { deleteRailwayProject } from '../services/railway.js'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { join } from 'path'

interface DeleteProjectProps {
  railwayToken: string
  githubToken: string
  onComplete: () => void
  onCancel: () => void
}

type Step = 'input-name' | 'confirm' | 'confirm-local-dir' | 'deleting' | 'complete'

interface DeletionResult {
  railway: { success: boolean; message: string }
  github: { success: boolean; message: string }
  localDirectory?: { success: boolean; message: string }
}

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

async function railwayRequest<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Railway API error: ${response.status} - ${text}`)
  }

  const result = (await response.json()) as GraphQLResponse<T>

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Railway GraphQL error: ${result.errors[0].message}`)
  }

  if (!result.data) {
    throw new Error('No data in Railway response')
  }

  return result.data
}

async function findRailwayProjectByName(
  token: string,
  projectName: string
): Promise<string | null> {
  const query = `
    query {
      projects {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `

  const data = await railwayRequest<{
    projects: {
      edges: Array<{ node: { id: string; name: string } }>
    }
  }>(token, query)

  const project = data.projects.edges.find(
    (edge) => edge.node.name === projectName
  )

  return project?.node.id ?? null
}

export function DeleteProject({
  railwayToken,
  githubToken,
  onComplete,
  onCancel,
}: DeleteProjectProps): React.ReactElement {
  const [step, setStep] = useState<Step>('input-name')
  const [inputValue, setInputValue] = useState('')
  const [projectName, setProjectName] = useState('')
  const [result, setResult] = useState<DeletionResult | null>(null)
  const [localDirExists, setLocalDirExists] = useState(false)
  const [deleteLocalDir, setDeleteLocalDir] = useState(false)

  const handleNameSubmit = () => {
    const name = inputValue.trim()
    if (name) {
      setProjectName(name)
      setInputValue('')

      // Check if local directory exists
      const dirPath = join(process.cwd(), name)
      const exists = existsSync(dirPath)
      setLocalDirExists(exists)
      setDeleteLocalDir(exists) // Default to true if directory exists

      setStep('confirm')
    }
  }

  const handleConfirmSelect = (item: { value: string }) => {
    if (item.value === 'yes') {
      if (localDirExists) {
        setStep('confirm-local-dir')
      } else {
        setStep('deleting')
      }
    } else if (item.value === 'no') {
      onCancel()
    }
  }

  const handleLocalDirSelect = (item: { value: string }) => {
    setDeleteLocalDir(item.value === 'yes')
    setStep('deleting')
  }

  useEffect(() => {
    if (step === 'deleting') {
      performDeletion()
    }
  }, [step])

  const performDeletion = async () => {
    const deletionResult: DeletionResult = {
      railway: { success: false, message: '' },
      github: { success: false, message: '' },
    }

    // Delete Railway project
    try {
      const projectId = await findRailwayProjectByName(railwayToken, projectName)

      if (!projectId) {
        deletionResult.railway.message = 'Project not found (may already be deleted)'
      } else {
        await deleteRailwayProject(railwayToken, projectId)
        deletionResult.railway.success = true
        deletionResult.railway.message = 'Deleted successfully'
      }
    } catch (err) {
      deletionResult.railway.message = err instanceof Error ? err.message : 'Unknown error'
    }

    // Delete GitHub repo
    try {
      const githubUsername = await getGitHubUsername(githubToken)
      await deleteGitHubRepo(githubToken, githubUsername, projectName)
      deletionResult.github.success = true
      deletionResult.github.message = 'Deleted successfully'
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('Not Found')) {
        deletionResult.github.message = 'Repository not found (may already be deleted)'
      } else {
        deletionResult.github.message = errorMessage
      }
    }

    // Delete local directory if requested
    if (deleteLocalDir && localDirExists) {
      deletionResult.localDirectory = { success: false, message: '' }
      try {
        const dirPath = join(process.cwd(), projectName)
        await rm(dirPath, { recursive: true, force: true })
        deletionResult.localDirectory.success = true
        deletionResult.localDirectory.message = 'Deleted successfully'
      } catch (err) {
        deletionResult.localDirectory.message = err instanceof Error ? err.message : 'Unknown error'
      }
    }

    setResult(deletionResult)
    setStep('complete')
  }

  const handleReturnToMenu = () => {
    onComplete()
  }

  return (
    <Box flexDirection="column">
      {step === 'input-name' && (
        <Box flexDirection="column">
          <Text color="yellow" bold>
            ⚠️  Project Deletion
          </Text>
          <Text> </Text>
          <Text color="red">
            This will permanently delete:
          </Text>
          <Text>  • Railway project (including database)</Text>
          <Text>  • GitHub repository (including all code)</Text>
          <Text> </Text>
          <Text color="gray">
            Note: Local files on your machine will NOT be deleted.
          </Text>
          <Text> </Text>
          <Box>
            <Text color="green">? </Text>
            <Text>Enter project name to delete: </Text>
            <InkTextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleNameSubmit}
            />
          </Box>
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Text color="red" bold>
            ⚠️  FINAL CONFIRMATION
          </Text>
          <Text> </Text>
          <Text>
            You are about to delete project: <Text bold color="yellow">{projectName}</Text>
          </Text>
          <Text> </Text>
          <Text>This will delete:</Text>
          <Text>  • Railway project</Text>
          <Text>  • GitHub repository</Text>
          {localDirExists && (
            <Text>  • Local directory: <Text color="yellow">./{projectName}/</Text></Text>
          )}
          <Text> </Text>
          <Text color="red" bold>
            This action CANNOT be undone!
          </Text>
          <Text> </Text>
          <Box flexDirection="column">
            <Text>Are you sure you want to continue?</Text>
            <Text> </Text>
            <SelectInput
              items={[
                { label: 'No, cancel', value: 'no' },
                { label: 'Yes, delete permanently', value: 'yes' },
              ]}
              onSelect={handleConfirmSelect}
            />
          </Box>
        </Box>
      )}

      {step === 'confirm-local-dir' && (
        <Box flexDirection="column">
          <Text color="yellow" bold>
            📁 Local Directory Found
          </Text>
          <Text> </Text>
          <Text>
            A local directory <Text bold color="cyan">./{projectName}/</Text> exists in the current working directory.
          </Text>
          <Text> </Text>
          <Text>Do you want to delete it as well?</Text>
          <Text> </Text>
          <SelectInput
            items={[
              { label: 'Yes, delete local directory', value: 'yes' },
              { label: 'No, keep local directory', value: 'no' },
            ]}
            onSelect={handleLocalDirSelect}
          />
        </Box>
      )}

      {step === 'deleting' && (
        <Box flexDirection="column">
          <Spinner label={`Deleting project "${projectName}"...`} />
        </Box>
      )}

      {step === 'complete' && result && (
        <Box flexDirection="column">
          <Text>{'─'.repeat(60)}</Text>
          <Text> </Text>
          <Text bold>
            Deletion Summary for: <Text color="yellow">{projectName}</Text>
          </Text>
          <Text> </Text>
          <Text>
            Railway Project: {' '}
            {result.railway.success ? (
              <Text color="green">✓ {result.railway.message}</Text>
            ) : (
              <Text color="gray">⚠ {result.railway.message}</Text>
            )}
          </Text>
          <Text>
            GitHub Repository: {' '}
            {result.github.success ? (
              <Text color="green">✓ {result.github.message}</Text>
            ) : (
              <Text color="gray">⚠ {result.github.message}</Text>
            )}
          </Text>
          {result.localDirectory && (
            <Text>
              Local Directory: {' '}
              {result.localDirectory.success ? (
                <Text color="green">✓ {result.localDirectory.message}</Text>
              ) : (
                <Text color="red">✗ {result.localDirectory.message}</Text>
              )}
            </Text>
          )}
          <Text> </Text>
          {(result.railway.success || result.github.success || result.localDirectory?.success) && (
            <Text color="green" bold>
              Resources deleted successfully.
            </Text>
          )}
          {!result.railway.success && !result.github.success && !result.localDirectory?.success && (
            <Text color="yellow">
              No resources were found to delete.
            </Text>
          )}
          <Text> </Text>
          <Text>{'─'.repeat(60)}</Text>
          <Text> </Text>
          <Box>
            <Text color="green">? </Text>
            <Text>Press Enter to return to main menu... </Text>
            <InkTextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleReturnToMenu}
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
