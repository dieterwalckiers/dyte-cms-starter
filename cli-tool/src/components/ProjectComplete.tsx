import React, { useState } from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'

interface ProjectCompleteProps {
  cmsUrl: string
  repoUrl: string
  websiteUrl: string
  onReturnToMenu: () => void
}

export function ProjectComplete({
  cmsUrl,
  repoUrl,
  websiteUrl,
  onReturnToMenu,
}: ProjectCompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = () => {
    onReturnToMenu()
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{'─'.repeat(60)}</Text>
      <Text> </Text>
      <Text bold color="green">
        {'  '}Done! Your project is ready.
      </Text>
      <Text> </Text>
      <Text>
        {'  '}CMS Admin:    {cmsUrl}
      </Text>
      <Text>
        {'  '}Website:      {websiteUrl}
      </Text>
      <Text>
        {'  '}GitHub Repo:  {repoUrl}
      </Text>
      <Text> </Text>
      <Text color="gray">
        {'  '}Note: Initial static site build is in progress (3-5 min).
      </Text>
      <Text color="gray">
        {'  '}The website will be live once the build completes.
      </Text>
      <Text> </Text>
      <Text>{'  '}Next steps, either:</Text>
      <Text>{'  '}- Open the CMS admin and start editing content right away. Content changes auto-deploy (wait for SSG to complete)</Text>
      <Text>{'  '}- Seed some starter content using the CLI tool</Text>
      <Text> </Text>
      <Text>{'  '}Note: any changes you make in your instance of the cms starter that would benefit future outputs,</Text>
      <Text>{'  '}be a sport and incorporate them in dyte-cms-starter :)</Text>
      <Text>{'─'.repeat(60)}</Text>
      <Text> </Text>
      <Box>
        <Text color="green">? </Text>
        <Text>Press Enter to return to main menu... </Text>
        <InkTextInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
        />
      </Box>
    </Box>
  )
}
