import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'
import { Spinner } from './Spinner.js'
import {
  authenticatePayload,
  testPayloadConnection,
  eraseAllContent,
  seedContent,
} from '../services/payload.js'
import { seedSets } from '../seeds/index.js'
import type { SeedSet } from '../types/index.js'

interface DataManagementProps {
  railwayToken: string
  onComplete: () => void
  onCancel: () => void
}

type Step =
  | 'input-name'
  | 'select-environment'
  | 'input-email'
  | 'input-password'
  | 'connecting'
  | 'select-action'
  | 'confirm-erase'
  | 'select-seed'
  | 'confirm-seed'
  | 'executing'
  | 'complete'
  | 'error'

interface OperationResult {
  success: boolean
  message: string
  details?: string
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

async function getPayloadUrlFromRailway(
  token: string,
  projectName: string
): Promise<string | null> {
  // First find the project
  const projectQuery = `
    query {
      projects {
        edges {
          node {
            id
            name
            services {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `

  const projectData = await railwayRequest<{
    projects: {
      edges: Array<{
        node: {
          id: string
          name: string
          services: {
            edges: Array<{ node: { id: string; name: string } }>
          }
        }
      }>
    }
  }>(token, projectQuery)

  const project = projectData.projects.edges.find(
    edge => edge.node.name === projectName
  )

  if (!project) {
    return null
  }

  // Find the payload service - it's named after the project slug, not "payload"
  // So we find the non-Postgres service
  const payloadService = project.node.services.edges.find(
    edge => edge.node.name.toLowerCase() !== 'postgres'
  )

  if (!payloadService) {
    return null
  }

  // Get the service domain from the latest deployment
  const domainQuery = `
    query GetServiceDomain($serviceId: String!) {
      service(id: $serviceId) {
        deployments(first: 1) {
          edges {
            node {
              staticUrl
            }
          }
        }
      }
    }
  `

  const domainData = await railwayRequest<{
    service: {
      deployments: {
        edges: Array<{ node: { staticUrl: string | null } }>
      }
    }
  }>(token, domainQuery, { serviceId: payloadService.node.id })

  // Use static URL from the latest deployment
  const staticUrl = domainData.service.deployments.edges[0]?.node?.staticUrl
  if (staticUrl) {
    // Ensure URL has https:// prefix (Railway API returns just the domain)
    if (staticUrl.startsWith('http://') || staticUrl.startsWith('https://')) {
      return staticUrl
    }
    return `https://${staticUrl}`
  }

  // If no staticUrl, try to construct from service name (Railway's default pattern)
  // Railway domains follow the pattern: servicename-projectid.up.railway.app
  // but we can't easily get this without more API calls, so return null
  return null
}

export function DataManagement({
  railwayToken,
  onComplete,
  onCancel,
}: DataManagementProps): React.ReactElement {
  const [step, setStep] = useState<Step>('input-name')
  const [inputValue, setInputValue] = useState('')
  const [projectName, setProjectName] = useState('')
  const [environment, setEnvironment] = useState<'railway' | 'local'>('railway')
  const [payloadUrl, setPayloadUrl] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [selectedSeed, setSelectedSeed] = useState<SeedSet | null>(null)
  const [result, setResult] = useState<OperationResult | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleNameSubmit = () => {
    const name = inputValue.trim()
    if (name) {
      setProjectName(name)
      setInputValue('')
      setStep('select-environment')
    }
  }

  const handleEnvironmentSelect = (item: { value: string }) => {
    setEnvironment(item.value as 'railway' | 'local')
    setStep('input-email')
  }

  const handleEmailSubmit = () => {
    const email = inputValue.trim()
    if (email && email.includes('@')) {
      setAdminEmail(email)
      setInputValue('')
      setStep('input-password')
    }
  }

  const handlePasswordSubmit = () => {
    const password = inputValue
    if (password.length >= 8) {
      setAdminPassword(password)
      setInputValue('')
      setStep('connecting')
    }
  }

  const handleActionSelect = (item: { value: string }) => {
    if (item.value === 'erase') {
      setStep('confirm-erase')
    } else if (item.value === 'seed') {
      setStep('select-seed')
    } else if (item.value === 'cancel') {
      onCancel()
    }
  }

  const handleEraseConfirm = (item: { value: string }) => {
    if (item.value === 'yes') {
      setStep('executing')
    } else {
      setStep('select-action')
    }
  }

  const handleSeedSelect = (item: { value: string }) => {
    if (item.value === 'cancel') {
      setStep('select-action')
      return
    }
    const seed = seedSets.find(s => s.id === item.value)
    if (seed) {
      setSelectedSeed(seed)
      setStep('confirm-seed')
    }
  }

  const handleSeedConfirm = (item: { value: string }) => {
    if (item.value === 'yes') {
      setStep('executing')
    } else {
      setStep('select-seed')
    }
  }

  const handleReturnToMenu = () => {
    onComplete()
  }

  // Connect to Payload
  useEffect(() => {
    if (step === 'connecting') {
      connectToPayload()
    }
  }, [step])

  const connectToPayload = async () => {
    try {
      let url = ''

      if (environment === 'local') {
        url = 'http://localhost:3202'
      } else {
        setProgressMessage('Looking up Railway project...')
        const railwayUrl = await getPayloadUrlFromRailway(railwayToken, projectName)
        if (!railwayUrl) {
          setErrorMessage(`Could not find Payload service for project "${projectName}" on Railway.`)
          setStep('error')
          return
        }
        url = railwayUrl
      }

      setPayloadUrl(url)
      setProgressMessage('Testing connection...')

      const isReachable = await testPayloadConnection(url)
      if (!isReachable) {
        setErrorMessage(`Could not connect to Payload at ${url}. Make sure the service is running.`)
        setStep('error')
        return
      }

      setProgressMessage('Authenticating...')
      const token = await authenticatePayload(url, adminEmail, adminPassword)
      setAuthToken(token)
      setStep('select-action')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      setStep('error')
    }
  }

  // Execute operation
  useEffect(() => {
    if (step === 'executing') {
      executeOperation()
    }
  }, [step])

  const executeOperation = async () => {
    try {
      if (selectedSeed) {
        // Seed operation
        setProgressMessage('Seeding content...')
        const seedResult = await seedContent(
          payloadUrl,
          authToken,
          selectedSeed.pages,
          msg => setProgressMessage(msg)
        )
        setResult({
          success: true,
          message: 'Content seeded successfully!',
          details: `Created ${seedResult.pagesCreated} pages from "${selectedSeed.name}"`,
        })
      } else {
        // Erase operation
        setProgressMessage('Erasing content...')
        const eraseResult = await eraseAllContent(
          payloadUrl,
          authToken,
          msg => setProgressMessage(msg)
        )
        setResult({
          success: true,
          message: 'Content erased successfully!',
          details: `Deleted ${eraseResult.pagesDeleted} pages and ${eraseResult.mediaDeleted} media items`,
        })
      }
      setStep('complete')
    } catch (err) {
      setResult({
        success: false,
        message: 'Operation failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      })
      setStep('complete')
    }
  }

  return (
    <Box flexDirection="column">
      {step === 'input-name' && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Data Management
          </Text>
          <Text> </Text>
          <Text>
            Manage content for an existing project:
          </Text>
          <Text color="gray">  - Erase all CMS content (pages and media)</Text>
          <Text color="gray">  - Seed content from predefined templates</Text>
          <Text> </Text>
          <Box>
            <Text color="green">? </Text>
            <Text>Enter project name: </Text>
            <InkTextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleNameSubmit}
            />
          </Box>
        </Box>
      )}

      {step === 'select-environment' && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Select Environment
          </Text>
          <Text> </Text>
          <Text>
            Project: <Text color="yellow">{projectName}</Text>
          </Text>
          <Text> </Text>
          <Text>Where is this project running?</Text>
          <Text> </Text>
          <SelectInput
            items={[
              { label: 'Railway (production)', value: 'railway' },
              { label: 'Local (Docker)', value: 'local' },
            ]}
            onSelect={handleEnvironmentSelect}
          />
        </Box>
      )}

      {step === 'input-email' && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Admin Credentials
          </Text>
          <Text> </Text>
          <Text>
            Project: <Text color="yellow">{projectName}</Text> ({environment})
          </Text>
          <Text> </Text>
          <Box>
            <Text color="green">? </Text>
            <Text>Admin email: </Text>
            <InkTextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleEmailSubmit}
            />
          </Box>
        </Box>
      )}

      {step === 'input-password' && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Admin Credentials
          </Text>
          <Text> </Text>
          <Text>
            Project: <Text color="yellow">{projectName}</Text> ({environment})
          </Text>
          <Text>
            Email: <Text color="gray">{adminEmail}</Text>
          </Text>
          <Text> </Text>
          <Box>
            <Text color="green">? </Text>
            <Text>Admin password: </Text>
            <InkTextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handlePasswordSubmit}
              mask="*"
            />
          </Box>
        </Box>
      )}

      {step === 'connecting' && (
        <Box flexDirection="column">
          <Spinner label={progressMessage || 'Connecting to Payload CMS...'} />
        </Box>
      )}

      {step === 'error' && (
        <Box flexDirection="column">
          <Text color="red" bold>
            Connection Error
          </Text>
          <Text> </Text>
          <Text color="red">{errorMessage}</Text>
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

      {step === 'select-action' && (
        <Box flexDirection="column">
          <Text color="green" bold>
            Connected to Payload CMS
          </Text>
          <Text> </Text>
          <Text>
            Project: <Text color="yellow">{projectName}</Text>
          </Text>
          <Text>
            URL: <Text color="gray">{payloadUrl}</Text>
          </Text>
          <Text> </Text>
          <Text>What would you like to do?</Text>
          <Text> </Text>
          <SelectInput
            items={[
              { label: 'Erase all content', value: 'erase' },
              { label: 'Seed content', value: 'seed' },
              { label: 'Cancel and return to menu', value: 'cancel' },
            ]}
            onSelect={handleActionSelect}
          />
        </Box>
      )}

      {step === 'confirm-erase' && (
        <Box flexDirection="column">
          <Text color="red" bold>
            Confirm Content Erasure
          </Text>
          <Text> </Text>
          <Text>
            This will permanently delete all pages and media from:
          </Text>
          <Text color="yellow" bold>  {projectName}</Text>
          <Text> </Text>
          <Text color="gray">
            Note: User accounts will be preserved.
          </Text>
          <Text> </Text>
          <Text color="red" bold>
            This action cannot be undone!
          </Text>
          <Text> </Text>
          <SelectInput
            items={[
              { label: 'No, cancel', value: 'no' },
              { label: 'Yes, erase all content', value: 'yes' },
            ]}
            onSelect={handleEraseConfirm}
          />
        </Box>
      )}

      {step === 'select-seed' && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Select Seed Set
          </Text>
          <Text> </Text>
          <Text>Choose a content template to seed:</Text>
          <Text> </Text>
          <SelectInput
            items={[
              ...seedSets.map(seed => ({
                label: `${seed.name} - ${seed.description}`,
                value: seed.id,
              })),
              { label: 'Cancel', value: 'cancel' },
            ]}
            onSelect={handleSeedSelect}
          />
        </Box>
      )}

      {step === 'confirm-seed' && selectedSeed && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Confirm Seeding
          </Text>
          <Text> </Text>
          <Text>
            Seed set: <Text color="yellow">{selectedSeed.name}</Text>
          </Text>
          <Text color="gray">{selectedSeed.description}</Text>
          <Text> </Text>
          <Text>This will create {selectedSeed.pages.length} pages:</Text>
          {selectedSeed.pages.map(page => (
            <Text key={page.slug} color="gray">  - {page.title} (/{page.slug})</Text>
          ))}
          <Text> </Text>
          <Text color="yellow">
            Note: Existing pages with the same slugs may cause conflicts.
          </Text>
          <Text> </Text>
          <SelectInput
            items={[
              { label: 'Yes, seed content', value: 'yes' },
              { label: 'No, go back', value: 'no' },
            ]}
            onSelect={handleSeedConfirm}
          />
        </Box>
      )}

      {step === 'executing' && (
        <Box flexDirection="column">
          <Spinner label={progressMessage || 'Processing...'} />
        </Box>
      )}

      {step === 'complete' && result && (
        <Box flexDirection="column">
          <Text>{'─'.repeat(60)}</Text>
          <Text> </Text>
          <Text bold color={result.success ? 'green' : 'red'}>
            {result.success ? '✓' : '✗'} {result.message}
          </Text>
          {result.details && (
            <Text color="gray">{result.details}</Text>
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
