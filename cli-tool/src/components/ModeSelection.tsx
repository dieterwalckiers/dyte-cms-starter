import React from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'

interface ModeSelectionProps {
  onStartNew: () => void
  onDelete: () => void
  onDataManagement: () => void
}

interface Item {
  label: string
  value: string
}

export function ModeSelection({
  onStartNew,
  onDelete,
  onDataManagement,
}: ModeSelectionProps): React.ReactElement {
  const items: Item[] = [
    {
      label: 'Start a new project',
      value: 'new',
    },
    {
      label: 'Delete an existing project',
      value: 'delete',
    },
    {
      label: 'Manage existing project data',
      value: 'data-management',
    },
  ]

  const handleSelect = (item: Item) => {
    if (item.value === 'new') {
      onStartNew()
    } else if (item.value === 'delete') {
      onDelete()
    } else if (item.value === 'data-management') {
      onDataManagement()
    }
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          What would you like to do?
        </Text>
      </Box>
      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  )
}
