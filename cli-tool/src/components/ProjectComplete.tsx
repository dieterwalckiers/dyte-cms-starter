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
      <Text>{'  '}Next steps:</Text>
      <Text>{'  '}1. Open the CMS admin and start editing content</Text>
      <Text>{'  '}2. Create new pages in the Pages collection</Text>
      <Text>{'  '}3. Any content changes will auto-deploy to your website</Text>
      <Text> </Text>
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
