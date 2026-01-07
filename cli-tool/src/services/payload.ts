/**
 * Payload CMS API Integration Service
 * Provides functions for authenticating with and interacting with Payload CMS via REST API
 */

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
    body: object
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
