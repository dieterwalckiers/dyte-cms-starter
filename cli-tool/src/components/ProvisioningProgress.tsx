import React from 'react'
import { Box, Text } from 'ink'
import InkSpinner from 'ink-spinner'
import type { ProvisioningStep } from '../types/index.js'

interface ProvisioningProgressProps {
  steps: ProvisioningStep[]
}

export function ProvisioningProgress({
  steps,
}: ProvisioningProgressProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Creating project... sit back, this can take a while</Text>
      <Text> </Text>
      {steps.map((step, idx) => (
        <Box key={idx} flexDirection="column">
          <Box>
            {step.status === 'complete' && (
              <Text color="green">{'  ✓ '}</Text>
            )}
            {step.status === 'in_progress' && (
              <Text color="cyan">
                {'  '}
                <InkSpinner type="dots" />
                {' '}
              </Text>
            )}
            {step.status === 'pending' && (
              <Text color="gray">{'  ○ '}</Text>
            )}
            {step.status === 'error' && (
              <Text color="red">{'  ✗ '}</Text>
            )}
            <Text
              color={
                step.status === 'complete'
                  ? 'green'
                  : step.status === 'error'
                    ? 'red'
                    : step.status === 'in_progress'
                      ? 'white'
                      : 'gray'
              }
            >
              {step.label}
            </Text>
            {step.error && (
              <Text color="red"> - {step.error}</Text>
            )}
          </Box>
          {step.details && step.details.length > 0 && step.status === 'in_progress' && (
            <Box flexDirection="column" marginLeft={4}>
              {step.details.map((line, lineIdx) => (
                <Text key={lineIdx} color="gray" dimColor>
                  {line}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
