import React, { useState } from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'

interface ProjectErrorProps {
  error: string
  onReturnToMenu: () => void
}

export function ProjectError({
  error,
  onReturnToMenu,
}: ProjectErrorProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = () => {
    onReturnToMenu()
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="red" bold>
        Error during provisioning:
      </Text>
      <Text color="red">{error}</Text>
      <Text> </Text>
      <Text color="gray">
        Local files have been preserved. You can retry provisioning manually.
      </Text>
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
