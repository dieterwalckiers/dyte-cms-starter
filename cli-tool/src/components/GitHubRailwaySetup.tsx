import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { openBrowser } from '../services/browser.js'

interface GitHubRailwaySetupProps {
  onComplete: () => void
  onCancel: () => void
}

type SetupStep = 'instructions' | 'success'

export function GitHubRailwaySetup({
  onComplete,
  onCancel,
}: GitHubRailwaySetupProps): React.ReactElement {
  const [step, setStep] = useState<SetupStep>('instructions')
  const [browserOpened, setBrowserOpened] = useState(false)

  useEffect(() => {
    if (!browserOpened) {
      // Open directly to GitHub app settings for Railway
      openBrowser('https://github.com/settings/installations')
      setBrowserOpened(true)
    }
  }, [browserOpened])

  useInput((input, key) => {
    if (step === 'instructions') {
      if (key.return) {
        setStep('success')
        // Continue immediately - we'll retry the connection
        setTimeout(() => {
          onComplete()
        }, 500)
      } else if (input.toLowerCase() === 'q' || key.escape) {
        onCancel()
      }
    }
  })

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX={2}
        paddingY={1}
      >
        <Text bold color="yellow">
          GitHub Repository Access Required
        </Text>
        <Text>{'─'.repeat(50)}</Text>
        <Text> </Text>
        <Text>
          Railway needs access to your GitHub repository to deploy.
        </Text>
        <Text> </Text>
        <Text>
          A browser window should have opened to{' '}
          <Text color="cyan">github.com/settings/installations</Text>
        </Text>
        <Text> </Text>
        <Text bold>Steps to grant access:</Text>
        <Text>1. Find "Railway" in the list of installed GitHub Apps</Text>
        <Text>2. Click "Configure" next to Railway</Text>
        <Text>3. Under "Repository access":</Text>
        <Text>   - Select "All repositories", OR</Text>
        <Text>   - Click "Select repositories" and add your new repo</Text>
        <Text>4. Click "Save" to apply changes</Text>
        <Text> </Text>
        <Text color="gray">
          Note: If Railway isn't installed, visit railway.app/account first.
        </Text>
        <Text> </Text>
        <Text>5. Come back here and press Enter to retry</Text>
      </Box>

      {step === 'instructions' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>
            Press <Text bold>Enter</Text> when done, or{' '}
            <Text bold>Q</Text> to cancel
          </Text>
        </Box>
      )}

      {step === 'success' && (
        <Box marginTop={1}>
          <Text color="green">✓ Retrying connection...</Text>
        </Box>
      )}
    </Box>
  )
}
