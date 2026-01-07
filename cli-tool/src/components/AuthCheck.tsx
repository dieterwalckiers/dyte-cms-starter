import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'
import { Spinner } from './Spinner.js'
import type { AuthStatus } from '../types/index.js'
import {
  checkAuthStatus,
  getClaudeApiKey,
  getRailwayToken,
  getGitHubToken,
  saveClaudeApiKey,
  saveRailwayToken,
  saveGitHubToken,
} from '../services/auth.js'
import { getConfigDir } from '../services/config.js'

interface AuthCheckProps {
  onComplete: (credentials: {
    claudeApiKey: string
    railwayToken: string
    githubToken: string
  }) => void
}

type AuthStep =
  | 'checking'
  | 'prompt-claude'
  | 'save-claude'
  | 'prompt-railway'
  | 'save-railway'
  | 'prompt-github'
  | 'save-github'
  | 'complete'

export function AuthCheck({ onComplete }: AuthCheckProps): React.ReactElement {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [step, setStep] = useState<AuthStep>('checking')
  const [inputValue, setInputValue] = useState('')
  const [saveChoice, setSaveChoice] = useState<'yes' | 'no' | null>(null)

  // Current credentials
  const [claudeKey, setClaudeKey] = useState<string>('')
  const [railwayToken, setRailwayToken] = useState<string>('')
  const [githubToken, setGithubToken] = useState<string>('')

  useEffect(() => {
    async function check() {
      const authStatus = await checkAuthStatus()
      setStatus(authStatus)

      // Set existing credentials
      const existingClaude = getClaudeApiKey()
      const existingRailway = getRailwayToken()
      const existingGithub = getGitHubToken()

      if (existingClaude) setClaudeKey(existingClaude)
      if (existingRailway) setRailwayToken(existingRailway)
      if (existingGithub) setGithubToken(existingGithub)

      // Determine first missing credential
      if (!authStatus.claude.authenticated) {
        setStep('prompt-claude')
      } else if (!authStatus.railway.authenticated) {
        setStep('prompt-railway')
      } else if (!authStatus.github.authenticated) {
        setStep('prompt-github')
      } else {
        setStep('complete')
      }
    }
    check()
  }, [])

  useEffect(() => {
    if (step === 'complete' && claudeKey && railwayToken && githubToken) {
      onComplete({
        claudeApiKey: claudeKey,
        railwayToken,
        githubToken,
      })
    }
  }, [step, claudeKey, railwayToken, githubToken, onComplete])

  const handleClaudeSubmit = () => {
    if (inputValue.trim()) {
      setClaudeKey(inputValue.trim())
      setInputValue('')
      setStep('save-claude')
    }
  }

  const handleRailwaySubmit = () => {
    if (inputValue.trim()) {
      setRailwayToken(inputValue.trim())
      setInputValue('')
      setStep('save-railway')
    }
  }

  const handleGithubSubmit = () => {
    if (inputValue.trim()) {
      setGithubToken(inputValue.trim())
      setInputValue('')
      setStep('save-github')
    }
  }

  const handleSaveChoice = (choice: string) => {
    const save = choice.toLowerCase().startsWith('y')
    if (step === 'save-claude') {
      if (save) saveClaudeApiKey(claudeKey)
      setSaveChoice(null)
      if (!status?.railway.authenticated) {
        setStep('prompt-railway')
      } else if (!status?.github.authenticated) {
        setStep('prompt-github')
      } else {
        setStep('complete')
      }
    } else if (step === 'save-railway') {
      if (save) saveRailwayToken(railwayToken)
      setSaveChoice(null)
      if (!status?.github.authenticated) {
        setStep('prompt-github')
      } else {
        setStep('complete')
      }
    } else if (step === 'save-github') {
      if (save) saveGitHubToken(githubToken)
      setSaveChoice(null)
      setStep('complete')
    }
  }

  if (step === 'checking') {
    return <Spinner label="Checking authentication..." />
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>Checking authentication...</Text>

      {status && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            {status.railway.authenticated ? (
              <Text color="green">{'  ✓ '}</Text>
            ) : (
              <Text color="red">{'  ✗ '}</Text>
            )}
            Railway:{' '}
            {status.railway.authenticated
              ? `logged in as ${status.railway.user}`
              : 'not authenticated'}
          </Text>
          <Text>
            {status.github.authenticated ? (
              <Text color="green">{'  ✓ '}</Text>
            ) : (
              <Text color="red">{'  ✗ '}</Text>
            )}
            GitHub:{' '}
            {status.github.authenticated
              ? `logged in as ${status.github.user}`
              : 'not authenticated'}
          </Text>
          <Text>
            {status.claude.authenticated ? (
              <Text color="green">{'  ✓ '}</Text>
            ) : (
              <Text color="red">{'  ✗ '}</Text>
            )}
            Claude API key:{' '}
            {status.claude.authenticated ? 'configured' : 'not found'}
          </Text>
        </Box>
      )}

      {step === 'prompt-claude' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>Enter your Claude API key: </Text>
          <InkTextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleClaudeSubmit}
            mask="*"
          />
        </Box>
      )}

      {step === 'save-claude' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>Save for future projects? (y/n): </Text>
          <InkTextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => {
              handleSaveChoice(inputValue)
              setInputValue('')
            }}
          />
        </Box>
      )}

      {step === 'prompt-railway' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>Enter your Railway token: </Text>
          <InkTextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleRailwaySubmit}
            mask="*"
          />
        </Box>
      )}

      {step === 'save-railway' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>Save for future projects? (y/n): </Text>
          <InkTextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => {
              handleSaveChoice(inputValue)
              setInputValue('')
            }}
          />
        </Box>
      )}

      {step === 'prompt-github' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>Enter your GitHub token (required scopes: repo and workflow and optionally delete_repo): </Text>
          <InkTextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleGithubSubmit}
            mask="*"
          />
        </Box>
      )}

      {step === 'save-github' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>Save for future projects? (y/n): </Text>
          <InkTextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => {
              handleSaveChoice(inputValue)
              setInputValue('')
            }}
          />
        </Box>
      )}

      {saveChoice === 'yes' && (
        <Text color="gray">
          {'  ✓ '}Saved to {getConfigDir()}/credentials.json
        </Text>
      )}
    </Box>
  )
}
