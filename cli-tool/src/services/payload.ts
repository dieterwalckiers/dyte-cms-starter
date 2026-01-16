/**
 * Payload CMS API Integration Service
 * Provides functions for authenticating with and interacting with Payload CMS via REST API
 */

import type { SeedPage } from '../types/index.js'

/**
 * Content block types for the Pages collection
 */
export interface HeroBlock {
  blockType: 'hero'
  headline: string
  subheadline?: string
  alignment?: 'left' | 'center' | 'right'
  links?: Array<{
    label: string
    url: string
    variant?: 'solid' | 'outline' | 'ghost'
  }>
}

export interface RichTextBlock {
  blockType: 'richText'
  content: object // Lexical JSON
}

export type ContentBlock = HeroBlock | RichTextBlock

/**
 * Wait for Payload CMS to be ready by polling the API
 * Returns when Payload responds successfully to health check
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param maxAttempts - Maximum number of polling attempts (default: 60)
 * @param intervalMs - Milliseconds between polling attempts (default: 5000)
 * @param initialDelayMs - Initial delay before starting to poll in milliseconds (default: 180000 = 3 minutes)
 * @throws Error if Payload doesn't become ready within maxAttempts
 */
export async function waitForPayloadReady(
  payloadUrl: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000,
  initialDelayMs: number = 180_000,
): Promise<void> {
  // Wait for initial delay before starting to poll
  // This gives Railway time to deploy the service before we start checking
  if (initialDelayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, initialDelayMs))
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try to hit the Payload API endpoint
      // Using /api/users endpoint as a health check (doesn't require auth for OPTIONS)
      const response = await fetch(`${payloadUrl}/api/users`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      // If we get any response (even 401), Payload is responding
      if (response.status === 401 || response.status === 200 || response.status === 403) {
        return // Payload is ready!
      }
    } catch (error) {
      // Network error or connection refused - Payload not ready yet
    }

    // Wait before next attempt (unless this was the last attempt)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  throw new Error(`Payload CMS did not become ready after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 1000}s)`)
}

/**
 * Authenticate with Payload CMS and get JWT token
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param email - Admin email address
 * @param password - Admin password
 * @returns JWT token string for subsequent API requests
 * @throws Error if authentication fails
 */
export async function authenticatePayload(
  payloadUrl: string,
  email: string,
  password: string
): Promise<string> {
  const response = await fetch(`${payloadUrl}/api/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Payload authentication failed: ${response.status} ${errorText}`)
  }

  const data = await response.json() as { token?: string }

  // Extract token from response
  if (!data.token) {
    throw new Error('No token returned from Payload authentication')
  }

  return data.token
}

/**
 * Create a page in Payload CMS via REST API
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param token - JWT authentication token
 * @param pageData - Page data to create
 * @returns Created page with ID
 * @throws Error if page creation fails
 */
export async function createPage(
  payloadUrl: string,
  token: string,
  pageData: {
    title: string
    slug: string
    showInMenu: boolean
    menuOrder?: number
    content: ContentBlock[]
  }
): Promise<{ id: string }> {
  const response = await fetch(`${payloadUrl}/api/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `JWT ${token}`,
    },
    body: JSON.stringify(pageData),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create page: ${response.status} ${errorText}`)
  }

  const data = await response.json() as { doc?: { id?: string } }

  if (!data.doc || !data.doc.id) {
    throw new Error('No page ID returned from Payload')
  }

  return { id: data.doc.id }
}

/**
 * Generate simple Lexical JSON content
 * Returns minimal valid Lexical structure with one paragraph
 *
 * @param text - Plain text content
 * @returns Lexical JSON object
 */
export function generateSimpleLexicalContent(text: string): object {
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: text,
              type: 'text',
              version: 1
            }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1
        }
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1
    }
  }
}

/**
 * Generate initial page content as blocks
 * Creates a Hero block with headline and optional RichText block
 *
 * @param projectName - Name of the project for welcome message
 * @param description - Optional description text
 * @returns Array of content blocks for the page
 */
export function generateInitialPageContent(projectName: string, description?: string): ContentBlock[] {
  const blocks: ContentBlock[] = [
    {
      blockType: 'hero',
      headline: `Welcome to ${projectName}`,
      subheadline: description || 'Your CMS-powered website is ready. Start creating amazing content!',
      alignment: 'center',
    },
  ]
  return blocks
}

/**
 * Get all documents from a collection with pagination support
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param token - JWT authentication token
 * @param collection - The collection slug (e.g., 'pages', 'media')
 * @returns Array of document objects with id fields
 */
export async function getAllDocuments(
  payloadUrl: string,
  token: string,
  collection: string
): Promise<Array<{ id: string }>> {
  const allDocs: Array<{ id: string }> = []
  let page = 1
  const limit = 100
  let hasMore = true

  while (hasMore) {
    const response = await fetch(`${payloadUrl}/api/${collection}?limit=${limit}&page=${page}`, {
      method: 'GET',
      headers: {
        'Authorization': `JWT ${token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to get ${collection}: ${response.status} ${errorText}`)
    }

    const data = await response.json() as {
      docs?: Array<{ id: string }>
      hasNextPage?: boolean
      totalPages?: number
    }

    if (data.docs && data.docs.length > 0) {
      allDocs.push(...data.docs)
    }

    hasMore = data.hasNextPage === true
    page++

    // Safety limit to prevent infinite loops
    if (page > 1000) {
      break
    }
  }

  return allDocs
}

/**
 * Delete a single document from a collection
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param token - JWT authentication token
 * @param collection - The collection slug
 * @param id - The document ID to delete
 */
export async function deleteDocument(
  payloadUrl: string,
  token: string,
  collection: string,
  id: string
): Promise<void> {
  const response = await fetch(`${payloadUrl}/api/${collection}/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `JWT ${token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to delete ${collection}/${id}: ${response.status} ${errorText}`)
  }
}

/**
 * Erase all content from pages and media collections
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param token - JWT authentication token
 * @param onProgress - Optional callback for progress updates
 * @returns Summary of deleted items
 */
export async function eraseAllContent(
  payloadUrl: string,
  token: string,
  onProgress?: (message: string) => void
): Promise<{ pagesDeleted: number; mediaDeleted: number }> {
  let pagesDeleted = 0
  let mediaDeleted = 0

  // Delete all pages
  onProgress?.('Fetching pages...')
  const pages = await getAllDocuments(payloadUrl, token, 'pages')
  for (const page of pages) {
    onProgress?.(`Deleting page ${page.id}...`)
    await deleteDocument(payloadUrl, token, 'pages', page.id)
    pagesDeleted++
  }

  // Delete all media
  onProgress?.('Fetching media...')
  const media = await getAllDocuments(payloadUrl, token, 'media')
  for (const item of media) {
    onProgress?.(`Deleting media ${item.id}...`)
    await deleteDocument(payloadUrl, token, 'media', item.id)
    mediaDeleted++
  }

  return { pagesDeleted, mediaDeleted }
}

/**
 * Create a page from seed data
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param token - JWT authentication token
 * @param seedPage - The seed page data
 * @returns Created page with ID
 */
export async function createPageFromSeed(
  payloadUrl: string,
  token: string,
  seedPage: SeedPage
): Promise<{ id: string }> {
  const pageData = {
    title: seedPage.title,
    slug: seedPage.slug,
    showInMenu: seedPage.showInMenu,
    menuOrder: seedPage.menuOrder,
    content: seedPage.content as ContentBlock[],
  }

  return createPage(payloadUrl, token, pageData)
}

/**
 * Seed content from a seed set
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @param token - JWT authentication token
 * @param pages - Array of seed pages to create
 * @param onProgress - Optional callback for progress updates
 * @returns Summary of created items
 */
export async function seedContent(
  payloadUrl: string,
  token: string,
  pages: SeedPage[],
  onProgress?: (message: string) => void
): Promise<{ pagesCreated: number }> {
  let pagesCreated = 0

  for (const seedPage of pages) {
    onProgress?.(`Creating page "${seedPage.title}"...`)
    await createPageFromSeed(payloadUrl, token, seedPage)
    pagesCreated++
  }

  return { pagesCreated }
}

/**
 * Test connection to Payload CMS (quick health check without initial delay)
 *
 * @param payloadUrl - The base URL of the Payload CMS instance
 * @returns true if Payload is responding, false otherwise
 */
export async function testPayloadConnection(payloadUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${payloadUrl}/api/users`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })
    // If we get any response (even 401), Payload is responding
    return response.status === 401 || response.status === 200 || response.status === 403
  } catch {
    return false
  }
}
