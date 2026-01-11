import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import InkTextInput from 'ink-text-input'
import type { ProjectConfig } from '../types/index.js'

interface QuestionnaireProps {
  onComplete: (config: ProjectConfig) => void
  withTestValues?: boolean
}

type QuestionStep =
  | 'project-name'
  | 'admin-email'
  | 'admin-password'
  | 'collection-description'
  | 'ftp-host'
  | 'ftp-username'
  | 'ftp-password'
  | 'ftp-path'
  | 'website-url'
  | 'complete'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Extracts the path portion from a URL.
 * e.g., "https://example.com/blog" -> "/blog"
 * e.g., "https://example.com" -> ""
 */
function extractPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove trailing slash if present (unless it's just "/")
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
    return pathname
  } catch {
    return ''
  }
}

export function Questionnaire({
  onComplete,
  withTestValues = false,
}: QuestionnaireProps): React.ReactElement {
  const [step, setStep] = useState<QuestionStep>('project-name')
  const [inputValue, setInputValue] = useState('')

  // Collected values
  const [projectName, setProjectName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [collectionDescription, setCollectionDescription] = useState('')
  const [ftpHost, setFtpHost] = useState('')
  const [ftpUsername, setFtpUsername] = useState('')
  const [ftpPassword, setFtpPassword] = useState('')
  const [ftpPath, setFtpPath] = useState('')

  // If withTestValues is true, immediately call onComplete with test values
  useEffect(() => {
    if (withTestValues) {
      const testWebsiteUrl = 'https://tkartel.gent/testdytecmsstarter'
      onComplete({
        projectName: 'testdytecmsstarter',
        projectSlug: toSlug('testdytecmsstarter'),
        adminEmail: 'd.walckiers@protonmail.com',
        adminPassword: 'respons1ve',
        collectionDescription: '',
        ftpHost: 'ftp.tkartel.gent',
        ftpUsername: 'tkartelgent@tkartelgent',
        ftpPassword: '3n52JC3j4557e2Uz91v8',
        ftpPath: '/www/testdytecmsstarter/',
        websiteUrl: testWebsiteUrl,
        websitePath: extractPathFromUrl(testWebsiteUrl),
      })
    }
  }, [withTestValues, onComplete])

  const handleSubmit = () => {
    const value = inputValue.trim()

    switch (step) {
      case 'project-name':
        if (value) {
          setProjectName(value)
          setInputValue('')
          setStep('admin-email')
        }
        break
      case 'admin-email':
        if (value && value.includes('@')) {
          setAdminEmail(value)
          setInputValue('')
          setStep('admin-password')
        }
        break
      case 'admin-password':
        if (value.length >= 8) {
          setAdminPassword(value)
          setInputValue('')
          setStep('collection-description')
        }
        break
      case 'collection-description':
        // Allow empty (skip collections)
        setCollectionDescription(value)
        setInputValue('')
        setStep('ftp-host')
        break
      case 'ftp-host':
        if (value) {
          setFtpHost(value)
          setInputValue('')
          setStep('ftp-username')
        }
        break
      case 'ftp-username':
        if (value) {
          setFtpUsername(value)
          setInputValue('')
          setStep('ftp-password')
        }
        break
      case 'ftp-password':
        if (value) {
          setFtpPassword(value)
          setInputValue('')
          setStep('ftp-path')
        }
        break
      case 'ftp-path':
        // Default to './' (root) if empty, ensure trailing slash
        let pathValue = value || './'
        if (!pathValue.endsWith('/')) {
          pathValue += '/'
        }
        setFtpPath(pathValue)
        setInputValue('')
        setStep('website-url')
        break
      case 'website-url':
        if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
          setInputValue('')
          setStep('complete')

          // Call completion callback
          onComplete({
            projectName: projectName,
            projectSlug: toSlug(projectName),
            adminEmail: adminEmail,
            adminPassword: adminPassword,
            collectionDescription: collectionDescription,
            ftpHost: ftpHost,
            ftpUsername: ftpUsername,
            ftpPassword: ftpPassword,
            ftpPath: ftpPath,
            websiteUrl: value,
            websitePath: extractPathFromUrl(value),
          })
        }
        break
    }
  }

  const renderQuestion = () => {
    switch (step) {
      case 'project-name':
        return (
          <Box>
            <Text color="green">? </Text>
            <Text>Project name: </Text>
            <InkTextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              placeholder="my-blog"
            />
          </Box>
        )
      case 'admin-email':
        return (
          <Box flexDirection="column">
            <Text color="gray">Project: {projectName}</Text>
            <Box>
              <Text color="green">? </Text>
              <Text>CMS admin email: </Text>
              <InkTextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                placeholder="admin@example.com"
              />
            </Box>
          </Box>
        )
      case 'admin-password':
        return (
          <Box flexDirection="column">
            <Text color="gray">Project: {projectName}</Text>
            <Text color="gray">Admin: {adminEmail}</Text>
            <Box>
              <Text color="green">? </Text>
              <Text>CMS admin password (min 8 chars): </Text>
              <InkTextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                mask="*"
              />
            </Box>
          </Box>
        )
      case 'collection-description':
        return (
          <Box flexDirection="column">
            <Text color="gray">Project: {projectName}</Text>
            <Text color="gray">Admin: {adminEmail}</Text>
            <Box marginTop={1} flexDirection="column">
              <Text>
                Describe any other content model besides Page (or press Enter to skip):
              </Text>
              <Box marginTop={1}>
                <Text color="green">{'> '}</Text>
                <InkTextInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={handleSubmit}
                  placeholder="Post model, (title, content, author). Author model (name, email), ..."
                />
              </Box>
            </Box>
          </Box>
        )
      case 'ftp-host':
        return (
          <Box flexDirection="column">
            <Text color="gray">Project: {projectName}</Text>
            <Box marginTop={1}>
              <Text bold>FTP deployment configuration:</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="green">? </Text>
              <Text>FTP host: </Text>
              <InkTextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                placeholder="ftp.myhost.com"
              />
            </Box>
          </Box>
        )
      case 'ftp-username':
        return (
          <Box flexDirection="column">
            <Text color="gray">FTP host: {ftpHost}</Text>
            <Box>
              <Text color="green">? </Text>
              <Text>FTP username: </Text>
              <InkTextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
              />
            </Box>
          </Box>
        )
      case 'ftp-password':
        return (
          <Box flexDirection="column">
            <Text color="gray">FTP host: {ftpHost}</Text>
            <Text color="gray">FTP user: {ftpUsername}</Text>
            <Box>
              <Text color="green">? </Text>
              <Text>FTP password: </Text>
              <InkTextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                mask="*"
              />
            </Box>
          </Box>
        )
      case 'ftp-path':
        return (
          <Box flexDirection="column">
            <Text color="gray">FTP host: {ftpHost}</Text>
            <Text color="gray">FTP user: {ftpUsername}</Text>
            <Box>
              <Text color="green">? </Text>
              <Text>FTP deploy path (press Enter for root): </Text>
              <InkTextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                placeholder="./  or  /my-blog  or  /public_html/blog"
              />
            </Box>
          </Box>
        )
      case 'website-url':
        return (
          <Box flexDirection="column">
            <Text color="gray">FTP host: {ftpHost}</Text>
            <Text color="gray">FTP path: {ftpPath}</Text>
            <Box>
              <Text color="green">? </Text>
              <Text>Website URL (full URL including path): </Text>
              <InkTextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                placeholder="https://example.com/my-blog"
              />
            </Box>
          </Box>
        )
      default:
        return null
    }
  }

  // Don't render anything if using test values (will auto-complete via useEffect)
  if (withTestValues) {
    return (
      <Box>
        <Text color="gray">Using test values...</Text>
      </Box>
    )
  }

  return <Box flexDirection="column">{renderQuestion()}</Box>
}
