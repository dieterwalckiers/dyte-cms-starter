import React from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'

interface TextInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  mask?: boolean
  placeholder?: string
}

export function TextInput({
  label,
  value,
  onChange,
  onSubmit,
  mask = false,
  placeholder,
}: TextInputProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text color="green">? </Text>
      <Text>{label}: </Text>
      <InkTextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        mask={mask ? '*' : undefined}
        placeholder={placeholder}
      />
    </Box>
  )
}
