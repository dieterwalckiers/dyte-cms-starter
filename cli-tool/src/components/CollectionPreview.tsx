import React, { useState } from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'
import type { GeneratedCollection } from '../types/index.js'

interface CollectionPreviewProps {
  collections: GeneratedCollection[]
  onAccept: () => void
  onReject: (feedback: string) => void
}

type Step = 'confirm' | 'feedback'

export function CollectionPreview({
  collections,
  onAccept,
  onReject,
}: CollectionPreviewProps): React.ReactElement {
  const [step, setStep] = useState<Step>('confirm')
  const [inputValue, setInputValue] = useState('')

  const handleConfirmSubmit = () => {
    const answer = inputValue.toLowerCase().trim()
    if (answer === 'y' || answer === 'yes') {
      onAccept()
    } else if (answer === 'n' || answer === 'no') {
      setInputValue('')
      setStep('feedback')
    }
  }

  const handleFeedbackSubmit = () => {
    const feedback = inputValue.trim()
    setInputValue('')
    onReject(feedback)
  }

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
      >
        <Text bold>Generated Collections Preview</Text>
        <Text>{'─'.repeat(50)}</Text>

        {collections.map((collection, idx) => (
          <Box key={collection.slug} flexDirection="column" marginTop={idx > 0 ? 1 : 0}>
            <Text bold color="yellow">
              {collection.name}
            </Text>
            {collection.fields.map((field, fieldIdx) => (
              <Text key={field.name}>
                {'  '}
                {fieldIdx === collection.fields.length - 1 ? '└── ' : '├── '}
                {field.name}
                <Text color="gray">
                  {' '}
                  ({field.type}
                  {field.required ? ', required' : ''}
                  {field.unique ? ', unique' : ''}
                  {field.relationTo ? ` → ${field.relationTo}` : ''})
                </Text>
              </Text>
            ))}
          </Box>
        ))}
      </Box>

      {step === 'confirm' && (
        <Box marginTop={1}>
          <Text color="green">? </Text>
          <Text>Does this look correct? (y/n): </Text>
          <InkTextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleConfirmSubmit}
          />
        </Box>
      )}

      {step === 'feedback' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green">? </Text>
          <Text>What should be changed? (or press Enter to regenerate without feedback):</Text>
          <Box marginTop={1}>
            <Text color="green">{'> '}</Text>
            <InkTextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleFeedbackSubmit}
              placeholder="e.g., Add a 'category' field to Posts"
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
